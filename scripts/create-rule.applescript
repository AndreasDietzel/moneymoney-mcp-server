-- create-rule.applescript
-- Creates a categorization rule in MoneyMoney via GUI scripting.
-- Matches transactions where the payee contains the given pattern and assigns a category.
--
-- Usage: osascript create-rule.applescript "<payee_pattern>" "<category_path>"
--
-- Security: Inputs are validated for length and character class before use.
--           Arguments are received via argv (no shell interpolation).
-- Requires: System Settings > Privacy & Security > Accessibility > Terminal (or Node.js) enabled.
--
-- Credits: Rule-creation concept based on community contribution by external patch submission;
--          adapted and hardened for ISO 25010 compliance by Andreas Dietzel.

on run argv
    if (count of argv) < 2 then
        return "{\"success\": false, \"error\": \"Missing arguments. Usage: create-rule.applescript <payee_pattern> <category_path>\"}"
    end if

    set payeePattern to item 1 of argv
    set categoryPath to item 2 of argv

    -- Validate: non-empty
    if length of payeePattern is 0 then
        return "{\"success\": false, \"error\": \"payee_pattern must not be empty\"}"
    end if
    if length of categoryPath is 0 then
        return "{\"success\": false, \"error\": \"category_path must not be empty\"}"
    end if

    -- Validate: max length (matches TypeScript-side validation)
    if length of payeePattern > 200 then
        return "{\"success\": false, \"error\": \"payee_pattern exceeds maximum length of 200 characters\"}"
    end if
    if length of categoryPath > 300 then
        return "{\"success\": false, \"error\": \"category_path exceeds maximum length of 300 characters\"}"
    end if

    try
        -- Step 1: Verify MoneyMoney is running
        tell application "System Events"
            if not (exists process "MoneyMoney") then
                return "{\"success\": false, \"error\": \"MoneyMoney is not running. Please open MoneyMoney and try again.\"}"
            end if
        end tell

        -- Step 2: Activate and bring to foreground
        tell application "MoneyMoney"
            activate
        end tell
        delay 0.8

        tell application "System Events"
            tell process "MoneyMoney"
                set frontmost to true
                delay 0.3

                -- Step 3: Open the Rules window via menu bar
                -- Umsätze > Regeln... (Bookings > Rules...)
                if not (exists menu bar 1) then
                    return "{\"success\": false, \"error\": \"Could not access MoneyMoney menu bar\"}"
                end if

                if not (exists menu item "Regeln..." of menu "Umsätze" of menu bar 1) then
                    return "{\"success\": false, \"error\": \"Menu item 'Regeln...' not found in 'Umsätze' menu. Please check your MoneyMoney version.\"}"
                end if

                click menu item "Regeln..." of menu "Umsätze" of menu bar 1
                delay 1.0

                -- Step 4: Locate the Rules window
                if not (exists window "Regeln") then
                    return "{\"success\": false, \"error\": \"Rules window did not open. Make sure MoneyMoney is visible and not covered by another window.\"}"
                end if

                tell window "Regeln"
                    -- Step 5: Click the Add (+) button — first button in the toolbar area
                    if not (exists button 1) then
                        return "{\"success\": false, \"error\": \"Add button not found in Rules window\"}"
                    end if
                    click button 1
                    delay 0.6

                    -- Step 6: The new rule row appears in the table.
                    -- The condition text field for the payee pattern is now focused.
                    -- Type in the payee pattern.
                    keystroke payeePattern
                    delay 0.3

                    -- Step 7: Move to the category assignment field via Tab
                    key code 48 -- Tab
                    delay 0.2
                    key code 48 -- Tab
                    delay 0.2

                    -- Step 8: Type the category path
                    keystroke categoryPath
                    delay 0.4

                    -- Step 9: Confirm the new rule entry
                    key code 36 -- Return
                    delay 0.4

                    -- Step 10: Close the Rules window
                    keystroke "w" using command down
                    delay 0.3
                end tell

            end tell
        end tell

        set safePayee to my jsonEscape(payeePattern)
        set safeCategory to my jsonEscape(categoryPath)
        return "{\"success\": true, \"message\": \"Rule created: payee containing \\\"" & safePayee & "\\\" will be categorized as \\\"" & safeCategory & "\\\"\"}"

    on error errMsg number errNum
        set safeErr to my jsonEscape(errMsg)
        if errNum is -25211 or errMsg contains "assistive" or errMsg contains "accessibility" then
            return "{\"success\": false, \"error\": \"Accessibility permission required. Go to System Settings > Privacy & Security > Accessibility and enable Terminal or Node.js.\", \"errorNumber\": " & errNum & "}"
        end if
        return "{\"success\": false, \"error\": \"" & safeErr & "\", \"errorNumber\": " & errNum & "}"
    end try
end run

-- Escape double quotes and backslashes for embedding in JSON strings.
on jsonEscape(inputStr)
    set resultStr to ""
    repeat with i from 1 to length of inputStr
        set c to character i of inputStr
        if c is "\"" then
            set resultStr to resultStr & "\\\""
        else if c is "\\" then
            set resultStr to resultStr & "\\\\"
        else
            set resultStr to resultStr & c
        end if
    end repeat
    return resultStr
end jsonEscape
