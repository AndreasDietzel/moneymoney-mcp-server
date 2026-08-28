-- export-portfolio.applescript
-- Exports the securities held in a MoneyMoney portfolio (Depot) account.
--
-- Usage: osascript export-portfolio.applescript "<account_reference>"
--
-- The account reference may be a UUID, an account number or an account name —
-- MoneyMoney resolves it. On success the XML property list is written to stdout.
--
-- Security: The account reference arrives via argv (no shell interpolation) and
--           is passed to MoneyMoney as a bound variable, never concatenated into
--           a script string.
--
-- Errors are intentionally NOT caught: osascript exits non-zero and the caller
-- maps MoneyMoney's message ("does not exist", "is not a portfolio") to a
-- readable error. This keeps stdout a pure property list.

on run argv
    if (count of argv) < 1 then
        error "Missing argument. Usage: export-portfolio.applescript <account_reference>" number -1700
    end if

    set accountRef to item 1 of argv

    if length of accountRef is 0 then
        error "account_reference must not be empty" number -1700
    end if
    if length of accountRef > 300 then
        error "account_reference exceeds maximum length of 300 characters" number -1700
    end if

    tell application "MoneyMoney" to export portfolio from account accountRef as "plist"
end run
