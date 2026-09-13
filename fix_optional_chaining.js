const fs = require('fs');
let file = 'g:/cityridetaxis-main/cityridetaxis-main/public/active-ride.html';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  /document\.querySelector\('#hidden-cancel button'\)\?\.click\(\)/g,
  "var c=document.querySelector('#hidden-cancel button'); if(c) c.click();"
);
content = content.replace(
  /detailsHtml\.querySelector\('button\\[onclick\\*="cancelRide"\\]'\)\?\.outerHTML/g,
  "(detailsHtml.querySelector('button[onclick*=\"cancelRide\"]') || {}).outerHTML"
);
content = content.replace(
  /JSON\.parse\(localStorage\.getItem\('cityride_member'\)\)\?\.id/g,
  "(JSON.parse(localStorage.getItem('cityride_member') || '{}') || {}).id"
);
content = content.replace(
  /parsed\?\.token/g,
  "(parsed && parsed.token)"
);
content = content.replace(
  /d\.features\[0\]\?\.geometry\.coordinates/g,
  "(d.features && d.features[0] && d.features[0].geometry ? d.features[0].geometry.coordinates : null)"
);
content = content.replace(
  /member\?\.token/g,
  "(member && member.token)"
);
content = content.replace(
  /document\.getElementById\('invoice-modal-comment'\)\?\.value/g,
  "(document.getElementById('invoice-modal-comment') || {}).value"
);

fs.writeFileSync(file, content, 'utf-8');
console.log('Replacements done!');
