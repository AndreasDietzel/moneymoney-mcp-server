-- create-batch-transfer.applescript
-- Hands a SEPA XML batch file to MoneyMoney for confirmation.
--
-- Usage: osascript create-batch-transfer.applescript "<xml_path>" ["transfer"|"direct-debit"]
--
-- Security: Arguments arrive via argv (no shell interpolation) and the path is
--           passed to MoneyMoney as a bound variable, never concatenated into a
--           script string — there is no AppleScript injection surface.
--
-- IMPORTANT: This only *drafts* the batch. MoneyMoney opens it for review and the
--            user must confirm and enter a TAN before any money moves. This
--            script can never send a payment on its own.

on run argv
    if (count of argv) < 1 then
        return "{\"success\": false, \"error\": \"Missing arguments. Usage: create-batch-transfer.applescript <xml_path> [transfer|direct-debit]\"}"
    end if

    set xmlPath to item 1 of argv

    set transferMode to "transfer"
    if (count of argv) is greater than 1 then
        set transferMode to item 2 of argv
    end if

    if length of xmlPath is 0 then
        return "{\"success\": false, \"error\": \"xml_path must not be empty\"}"
    end if
    if length of xmlPath > 1024 then
        return "{\"success\": false, \"error\": \"xml_path exceeds maximum length of 1024 characters\"}"
    end if
    if transferMode is not "transfer" and transferMode is not "direct-debit" then
        return "{\"success\": false, \"error\": \"mode must be either 'transfer' or 'direct-debit'\"}"
    end if

    -- Verify the file exists and is reachable before involving MoneyMoney.
    try
        set xmlAlias to (POSIX file xmlPath) as alias
    on error
        set safePath to my jsonEscape(xmlPath)
        return "{\"success\": false, \"error\": \"SEPA XML file not found or not readable: " & safePath & "\"}"
    end try

    tell application "System Events"
        if not (exists process "MoneyMoney") then
            return "{\"success\": false, \"error\": \"MoneyMoney is not running. Please open MoneyMoney and try again.\"}"
        end if
    end tell

    try
        if transferMode is "direct-debit" then
            tell application "MoneyMoney" to create batch direct debit from xmlAlias
            set verb to "direct debit batch"
        else
            tell application "MoneyMoney" to create batch transfer from xmlAlias
            set verb to "transfer batch"
        end if

        set safePath to my jsonEscape(xmlPath)
        return "{\"success\": true, \"requiresConfirmation\": true, \"message\": \"MoneyMoney opened the " & verb & " from \\\"" & safePath & "\\\". Review it in MoneyMoney and confirm with your TAN — nothing has been sent yet.\"}"

    on error errMsg number errNum
        set safeErr to my jsonEscape(errMsg)
        if errMsg contains "not allowed" or errMsg contains "permission" or errNum is -1743 then
            return "{\"success\": false, \"error\": \"MoneyMoney was not permitted to read the file. MoneyMoney is sandboxed — move the XML somewhere it may access, or grant access once via MoneyMoney's own file dialog.\", \"errorNumber\": " & errNum & "}"
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
