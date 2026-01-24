on run
	try
		-- Use official MoneyMoney AppleScript API to export transactions
		-- Export from 2017 onwards
		set fromDate to date "01.01.2017"
		set dateString to short date string of fromDate
		
		tell application "MoneyMoney"
			-- Export all transactions from 2017 as plist (XML property list)
			set plistData to export transactions from date dateString as "plist"
		end tell
		
		-- Save plist to file
		set exportPath to POSIX path of (path to home folder) & "Projects/moneymoney-mcp-server/data/transactions.plist"
		set exportFile to open for access POSIX file exportPath with write permission
		set eof of exportFile to 0
		write plistData to exportFile
		close access exportFile
		
		return "✅ Export successful: " & exportPath
		
	on error errMsg
		return "❌ Export failed: " & errMsg
	end try
end run
