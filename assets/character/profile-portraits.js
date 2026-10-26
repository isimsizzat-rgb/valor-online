/* Keep the saved character choice visible between the equipment slots. */
(function(){
 const previousProfile=profile;
 profile=function(){
  const html=previousProfile.apply(this,arguments);
  if(!state.class)return html;
  const template=document.createElement('template');
  template.innerHTML=html;
  const hero=template.content.querySelector('.vp-scene .vp-hero');
  if(!hero)return html;
  const portrait=document.createElement('div'),image=document.createElement('img');
  portrait.className='vp-hero valor-selected-profile-hero';
  image.src=valorCreationPortrait(state.class,state.gender);
  image.alt=(state.gender==='female'?'Kadın ':'Erkek ')+state.class+' karakteri';
  portrait.appendChild(image);
  hero.replaceWith(portrait);
  return template.innerHTML;
 };
 const previousRender=render;
 render=function(){
  const result=previousRender.apply(this,arguments);
  const image=document.getElementById('valor-hud-portrait');
  if(state.class&&image){
   const source=valorCreationPortrait(state.class,state.gender);
   if(image.getAttribute('src')!==source)image.src=source;
   image.alt=(state.gender==='female'?'Kadın ':'Erkek ')+state.class+' portresi';
   if(!image.parentElement.classList.contains('valor-hud-portrait-crop')){
    const crop=document.createElement('span');
    crop.className='valor-hud-portrait-crop';
    image.replaceWith(crop);
    crop.appendChild(image);
   }
  }
  return result;
 };
 render();
})();
