#!/usr/bin/osascript

tell application "MoneyMoney"
    set accountList to ""
    
    repeat with acc in accounts
        set accountList to accountList & "Name: " & (name of acc) & return
        set accountList to accountList & "UUID: " & (uuid of acc) & return
        set accountList to accountList & "Balance: " & (balance of acc) & " " & (currency of acc) & return
        set accountList to accountList & "Account Number: " & (account number of acc) & return
        set accountList to accountList & "Type: " & (portfolio of acc) & return
        set accountList to accountList & "---" & return
    end repeat
    
    return accountList
end tell
