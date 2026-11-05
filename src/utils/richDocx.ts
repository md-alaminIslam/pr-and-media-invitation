import {Paragraph,TextRun,AlignmentType,UnderlineType} from 'docx';
export function htmlToWordParagraphs(html:string):Paragraph[] {
 const doc=new DOMParser().parseFromString(html,'text/html');
 const paragraphs:Paragraph[]=[];
 const blocks=Array.from(doc.body.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li,td,th,blockquote')).filter(el=>!el.querySelector('p,div,h1,h2,h3,h4,h5,h6,li,td,th,blockquote'));
 if(!blocks.length)blocks.push(doc.body);
 const colorHex=(value:string)=>{if(/^#[0-9a-f]{6}$/i.test(value))return value.slice(1);if(/^#[0-9a-f]{3}$/i.test(value))return value.slice(1).split('').map(c=>c+c).join('');const rgb=value.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);if(rgb)return rgb.slice(1).map(n=>Number(n).toString(16).padStart(2,'0')).join('');return undefined;};
 for(const block of blocks) {
  const runs:TextRun[]=[];
  const walk=(node:Node,style:any)=>{
   if(node.nodeType===3){if(node.textContent)runs.push(new TextRun({...style,text:node.textContent}));return;}
   if(node.nodeType!==1)return;const el=node as HTMLElement;const tag=el.tagName.toLowerCase();const next={...style};
   if(tag==='br'){runs.push(new TextRun({break:1}));return;}
   if(['b','strong','th','h1','h2','h3','h4','h5','h6'].includes(tag))next.bold=true;
   if(['i','em'].includes(tag))next.italics=true;
   if(tag==='u')next.underline={type:UnderlineType.SINGLE};if(['s','strike'].includes(tag))next.strike=true;
   if(tag==='sub')next.subScript=true;if(tag==='sup')next.superScript=true;
   const css=el.style;if(css.fontFamily)next.font=css.fontFamily.split(',')[0].replace(/["']/g,'').trim();
   if(css.fontSize){const size=parseFloat(css.fontSize);next.size=Math.round(size*(css.fontSize.endsWith('px')?1.5:2));}
   if(css.fontWeight)next.bold=css.fontWeight==='bold'||Number(css.fontWeight)>=600;
   if(css.fontStyle)next.italics=css.fontStyle==='italic';
   if(css.textDecoration.includes('underline'))next.underline={type:UnderlineType.SINGLE};
   if(css.textDecoration.includes('line-through'))next.strike=true;
   const color=colorHex(css.color);if(color)next.color=color;const bg=colorHex(css.backgroundColor);if(bg)next.shading={fill:bg};
   for(const child of node.childNodes)walk(child,next);
  };
  const parents:HTMLElement[]=[];for(let el=block.parentElement;el&&el!==doc.body;el=el.parentElement)parents.unshift(el);
  let inherited:any={font:'Arial',size:24};for(const parent of parents){if(parent.style.fontFamily)inherited.font=parent.style.fontFamily.split(',')[0].replace(/["']/g,'');if(parent.style.color)inherited.color=colorHex(parent.style.color);if(parent.style.fontSize)inherited.size=Math.round(parseFloat(parent.style.fontSize)*(parent.style.fontSize.endsWith('px')?1.5:2));}
  if(block.tagName==='LI'){const list=block.parentElement;const index=list?Array.from(list.children).indexOf(block)+1:1;runs.push(new TextRun({text:list?.tagName==='OL'?index+'. ':'• ',...inherited}));}
  walk(block,inherited);
  const align=(block as HTMLElement).style.textAlign || parents.at(-1)?.style.textAlign;
  const alignment=align==='center'?AlignmentType.CENTER:align==='right'?AlignmentType.RIGHT:align==='justify'?AlignmentType.JUSTIFIED:AlignmentType.LEFT;
  paragraphs.push(new Paragraph({children:runs,alignment,spacing:{after:120,line:360}}));
 }
 return paragraphs;
}
