tell application "MoneyMoney"
	set accountList to accounts
	set resultText to "=== MoneyMoney Konten-Diagnose ===" & return & return
	
	repeat with acc in accountList
		set resultText to resultText & "Konto: " & name of acc & return
		
		try
			set resultText to resultText & "  UUID: " & uuid of acc & return
		end try
		
		try
			set resultText to resultText & "  Kontonummer: " & account number of acc & return
		end try
		
		try
			set resultText to resultText & "  IBAN: " & iban of acc & return
		end try
		
		try
			set resultText to resultText & "  Typ: " & type of acc & return
		end try
		
		try
			set resultText to resultText & "  Saldo: " & balance of acc & return
		end try
		
		set resultText to resultText & return & "---" & return & return
	end repeat
	
	return resultText
end tell
