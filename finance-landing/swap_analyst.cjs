const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const targetsStart = content.indexOf('{/* Analyst Price Targets */}');
const carouselStart = content.indexOf('{/* Analyst Carousel */}');
// Carousel ends at the closing div before the end of the container
// Let's find the exact strings.

const targetsRegex = /(\s*\{\/\* Analyst Price Targets \*\/\}.*?\}\)\(\)\})/s;
const carouselRegex = /(\s*\{\/\* Analyst Carousel \*\/\}.*?<\/div>\n\s*<\/div>)/s;

const targetsMatch = content.match(targetsRegex);
const carouselMatch = content.match(carouselRegex);

if (!targetsMatch || !carouselMatch) {
  console.log("Failed to match!");
  process.exit(1);
}

// Modify the carousel text to remove the scrollbar hider
let newCarousel = carouselMatch[1].replace(/style=\{\{scrollbarWidth:'none'\}\}/g, "className=\"flex overflow-x-auto gap-4 pb-6 snap-x snap-mandatory scrollbar-thin\"");
newCarousel = newCarousel.replace(/className="flex overflow-x-auto gap-4 pb-6 snap-x snap-mandatory" className="flex/g, 'className="flex'); // Just in case it replaced badly
// Actually, let's just do a simple replace on the exact line:
newCarousel = carouselMatch[1].replace(/style=\{\{scrollbarWidth:'none'\}\}/g, '');

let newContent = content.replace(targetsMatch[1], '___TARGETS___');
newContent = newContent.replace(carouselMatch[1], '___CAROUSEL___');

newContent = newContent.replace('___TARGETS___', newCarousel);
newContent = newContent.replace('___CAROUSEL___', targetsMatch[1]);

fs.writeFileSync('src/App.tsx', newContent);
console.log("Successfully swapped and updated slider!");
