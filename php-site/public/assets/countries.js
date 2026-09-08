export const countries = [
  ['TR','Türkiye','90'],['DE','Almanya','49'],['US','Amerika Birleşik Devletleri','1'],
  ['AZ','Azerbaycan','994'],['AT','Avusturya','43'],['BE','Belçika','32'],['GB','Birleşik Krallık','44'],
  ['BA','Bosna-Hersek','387'],['BG','Bulgaristan','359'],['CZ','Çekya','420'],['DK','Danimarka','45'],
  ['AE','Birleşik Arap Emirlikleri','971'],['FI','Finlandiya','358'],['FR','Fransa','33'],
  ['GE','Gürcistan','995'],['NL','Hollanda','31'],['HR','Hırvatistan','385'],['IQ','Irak','964'],
  ['IR','İran','98'],['IE','İrlanda','353'],['ES','İspanya','34'],['SE','İsveç','46'],
  ['CH','İsviçre','41'],['IT','İtalya','39'],['CA','Kanada','1'],['KZ','Kazakistan','7'],
  ['CY','Kıbrıs','357'],['XK','Kosova','383'],['MK','Kuzey Makedonya','389'],['HU','Macaristan','36'],
  ['NO','Norveç','47'],['UZ','Özbekistan','998'],['PL','Polonya','48'],['PT','Portekiz','351'],
  ['RO','Romanya','40'],['RU','Rusya','7'],['RS','Sırbistan','381'],['SK','Slovakya','421'],
  ['SA','Suudi Arabistan','966'],['UA','Ukrayna','380'],['GR','Yunanistan','30'],
];
export const flag = (code) => String.fromCodePoint(...code.split('').map((letter) => 127397 + letter.charCodeAt(0)));