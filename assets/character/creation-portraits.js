/* Approved six-character selection art: male/female Mage, Warrior, Archer. */
const VALOR_CREATION_PORTRAITS={"Büyücü":{"male":"assets/img/37cccab66ef334d1.webp","female":"assets/img/571e3ad365dcc25f.webp"},"Savaşçı":{"male":"assets/img/cc360834df856f41.webp","female":"assets/img/12ab879c47c8a6e9.webp"},"Okçu":{"male":"assets/img/60799670a55541a1.webp","female":"assets/img/4466a17c093865c5.webp"}};
const VALOR_CREATION_LINEUP="assets/img/7f5b5f2035e8f633.webp";
function valorCreationPortrait(cls,gender){return VALOR_CREATION_PORTRAITS[cls]?.[gender==='female'?'female':'male']||VALOR_CREATION_PORTRAITS['Savaşçı'].male;}
