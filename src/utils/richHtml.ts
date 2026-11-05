// Rebuild uploaded markup from a small formatting-only vocabulary.
// No scripts, events, external resources, forms, or document-wide styles survive.
const tags=new Set('p div span br strong b em i u s strike sub sup h1 h2 h3 h4 h5 h6 ul ol li blockquote table thead tbody tfoot tr td th hr font'.split(' '));
const styles=new Set('font-family font-size font-weight font-style color background-color text-decoration text-decoration-line text-align line-height margin-top margin-bottom margin-left margin-right padding-top padding-bottom padding-left padding-right border border-collapse width vertical-align'.split(' '));
export function escapeHtml(text:string):string {return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
export function textToHtml(text:string):string {return text.split('\n').map(line=>'<p>'+escapeHtml(line || '\u00a0')+'</p>').join('');}
export function sanitizeHtml(source:string):string {
 const doc=new DOMParser().parseFromString(source,'text/html');
 const result=document.implementation.createHTMLDocument('');
 function copy(node:Node,parent:Node) {
  if(node.nodeType===3){parent.appendChild(result.createTextNode(node.textContent || ''));return;}
  if(node.nodeType!==1)return;
  const input=node as HTMLElement;const tag=input.tagName.toLowerCase();
  if(['script','style','iframe','object','embed','svg','math','template','link','meta','noscript','form','input','button','textarea','select'].includes(tag))return;
  if(!tags.has(tag)){for(const child of input.childNodes)copy(child,parent);return;}
  const element=result.createElement(tag==='font'?'span':tag);
  for(const prop of Array.from(input.style)){const value=input.style.getPropertyValue(prop);if(styles.has(prop) && !/url\s*\(|expression|@|javascript|var\s*\(/i.test(value))element.style.setProperty(prop,value);}
  if(tag==='font') {
   const face=input.getAttribute('face');if(face && /^[\w\s,'"-]+$/.test(face))element.style.fontFamily=face;
   const color=input.getAttribute('color');if(color && /^(#[\da-f]{3,8}|[a-z]+)$/i.test(color))element.style.color=color;
   const sizes=[0,8,10,12,14,18,24,36];const size=Number(input.getAttribute('size'));if(size>=1&&size<=7)element.style.fontSize=sizes[size]+'pt';
  }
  const align=input.getAttribute('align');if(align&&['left','right','center','justify'].includes(align))element.style.textAlign=align;
  for(const attr of ['colspan','rowspan','start']){const value=input.getAttribute(attr);if(value&&/^\d{1,3}$/.test(value))element.setAttribute(attr,value);}
  const dir=input.getAttribute('dir');if(dir==='ltr'||dir==='rtl')element.dir=dir;
  parent.appendChild(element);for(const child of input.childNodes)copy(child,element);
 }
 for(const child of doc.body.childNodes)copy(child,result.body);
 return result.body.innerHTML;
}
export function htmlToText(html:string):string {
 const doc=new DOMParser().parseFromString(html,'text/html');
 for(const br of doc.querySelectorAll('br'))br.replaceWith('\n');
 for(const block of doc.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li,tr,blockquote'))block.append('\n');
 return (doc.body.textContent || '').replace(/\u00a0/g,' ').replace(/\n{3,}/g,'\n\n').trim();
}
