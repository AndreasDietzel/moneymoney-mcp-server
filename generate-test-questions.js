#!/usr/bin/env node

const fs = require('fs');
const plist = require('plist');

const data = fs.readFileSync('./data/transactions.plist', 'utf8');
const parsed = plist.parse(data);
const transactions = parsed.transactions || [];

const uuidMap = {
  '2677e957-db8e-4246-87b3-7f30d92782e9': 'UUID-1 (aktuell: Girokonto)',
  '1fef82b5-9d10-4b3e-9e0e-407fc733bc11': 'UUID-2 (aktuell: Tagesgeldkonto)',
  '2242c28a-c457-4a67-b2e0-8141d8de688d': 'UUID-3 (aktuell: Baufinanzierung) ⭐ ING-DiBa Raten',
  '049f4607-5f64-4d71-89cb-94d686f2603f': 'UUID-4 (aktuell: Direkt-Depot)'
};

console.log('=== TESTFRAGEN FÜR MONEYMONEY & PERPLEXITY ===\n');
console.log('Bitte teste diese Transaktionen in MoneyMoney und Perplexity:\n');

// Für jede UUID eine charakteristische Transaktion finden
Object.keys(uuidMap).forEach(uuid => {
  const txs = transactions.filter(tx => tx.accountUuid === uuid);
  
  if (txs.length === 0) {
    console.log(`\n### ${uuidMap[uuid]}: KEINE TRANSAKTIONEN`);
    return;
  }
  
  console.log(`\n### ${uuidMap[uuid]}`);
  console.log(`Anzahl Transaktionen: ${txs.length}`);
  
  // Zeige die ersten 3 charakteristischen Transaktionen
  const examples = txs.slice(0, 3);
  
  examples.forEach((tx, i) => {
    console.log(`\n**Test ${i + 1}:**`);
    console.log(`MoneyMoney-Frage: "Zeige mir Transaktionen von ${tx.name || 'unbekannt'} ${tx.amount < 0 ? 'über' : 'mit'} ${Math.abs(tx.amount).toFixed(2)} EUR"`);
    console.log(`Perplexity-Frage: "Auf welchem Konto ist die Transaktion von ${tx.name || 'unbekannt'} ${tx.amount < 0 ? 'über' : 'mit'} ${Math.abs(tx.amount).toFixed(2)} EUR vom ${new Date(tx.bookingDate).toLocaleDateString('de-DE')}?"`);
    console.log(`Verwendungszweck: "${tx.purpose || 'keine Angabe'}"`);
    console.log(`Erwartete UUID in Daten: ${uuid}`);
  });
});

// Spezielle Tests für ING-DiBa Raten
console.log('\n\n### SPEZIALFALL: ING-DiBa Baufinanzierung ###');
const ingTransactions = transactions.filter(tx => 
  tx.purpose && tx.purpose.includes('ING-DiBa AG 2010827641')
);

console.log(`\nGefundene ING-DiBa Transaktionen: ${ingTransactions.length}`);
if (ingTransactions.length > 0) {
  const latest = ingTransactions[0];
  console.log(`\n**Wichtigster Test:**`);
  console.log(`MoneyMoney-Frage: "Auf welchem Konto ist die Transaktion 'ING-DiBa AG 2010827641 30.12.2025 Zinsen 538,15 Tilgung 468,75'?"`);
  console.log(`Perplexity-Frage: "Auf welchem Konto sind die ING-DiBa Raten (2010827641)?"`);
  console.log(`UUID in Daten: ${latest.accountUuid}`);
  console.log(`Aktuelles Mapping: ${uuidMap[latest.accountUuid]}`);
}

console.log('\n\n=== ANLEITUNG ===');
console.log('1. Öffne MoneyMoney und suche nach den genannten Transaktionen');
console.log('2. Notiere, auf welchem Konto sie in MoneyMoney erscheinen');
console.log('3. Stelle die gleichen Fragen an Perplexity');
console.log('4. Vergleiche die Kontonamen: Stimmen sie überein?');
console.log('5. Wenn nicht, müssen wir das account-mappings.json anpassen\n');
