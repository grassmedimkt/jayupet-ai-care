'use client';

import { ChangeEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Check, ImagePlus, RefreshCcw, Sparkles, Upload } from 'lucide-react';
import { CARE_CONCERNS, CareConcern } from '@/lib/care-concerns';

type AnalysisType = 'charm' | 'care';
type Step = 'charm-upload' | 'charm-analyzing' | 'charm-result' | 'concern' | 'care-upload' | 'care-analyzing' | 'care-result';
type RetryReason = 'no_pet'|'blurry'|'dark'|'overexposed'|'too_far'|'target_hidden'|'unsupported_angle'|'wrong_pet_type';
type CareStatus = 'self_reported'|'clear'|'observed'|'caution';
type CharmTrait = { category:'face'|'coat'|'body'|'distinctive'; trait:string };
type AnalysisResponse = { petDetected:boolean; petType:'dog'|'cat'|'unknown'; imageQuality:'good'|'retry'; retryReason?:RetryReason|null; compliment?:string; visibleTraits?:CharmTrait[]; targetVisible?:boolean; careStatus?:CareStatus; visibleObservations?:string[]; safetyFlags?:string[]; rawSummary?:string; mode?:'live'|'mock' };
type ModelContext = { registerTool: (tool:{name:string;title:string;description:string;inputSchema:object;annotations:object;execute:(input:unknown)=>unknown},options?:{signal?:AbortSignal})=>void|Promise<void> };

declare global { interface Document { readonly modelContext?: ModelContext } }

const concerns = CARE_CONCERNS;
const MAX_SOURCE_BYTES=10*1024*1024,TARGET_BYTES=2*1024*1024,MAX_EDGE=1600;
const ALLOWED_TYPES=['image/jpeg','image/png','image/webp'];
const RETRY_GUIDE:Record<RetryReason,{title:string;detail:string}>={
  no_pet:{title:'반려동물이 잘 보이지 않아요',detail:'얼굴이나 몸이 화면 안에 들어오도록 다시 찍어주세요.'},
  blurry:{title:'사진이 조금 흐려요',detail:'휴대폰을 잠시 고정하고 초점을 맞춘 뒤 다시 찍어주세요.'},
  dark:{title:'사진이 조금 어두워요',detail:'확인할 부위가 보이도록 밝은 곳에서 다시 찍어주세요.'},
  overexposed:{title:'빛이 너무 강하게 반사됐어요',detail:'플래시를 끄고 각도를 조금 바꿔주세요.'},
  too_far:{title:'조금 더 가까이 보여주세요',detail:'확인할 아이나 부위가 화면의 절반 이상 보이도록 찍어주세요.'},
  target_hidden:{title:'확인할 부위가 가려졌어요',detail:'손이나 털에 가리지 않게 해당 부위를 화면 중앙에 담아주세요.'},
  unsupported_angle:{title:'다른 각도에서 한 번 더 찍어주세요',detail:'안내된 부위가 잘 보이도록 각도를 바꿔주세요.'},
  wrong_pet_type:{title:'고양이 사진이 필요해요',detail:'고양이 턱 노폐물은 고양이의 턱 아래 사진으로 확인할 수 있어요.'},
};

function retryMessage(result:AnalysisResponse){const reason=result.retryReason||(result.petDetected?'target_hidden':'no_pet');const guide=RETRY_GUIDE[reason];return `${guide.title} ${guide.detail}`}

function careResultHeading(status:CareStatus|undefined){
  if(status==='caution')return '전문가의 확인이 먼저 필요해 보여요';
  if(status==='observed')return '사진에서 관리해볼 특징이 보여요';
  if(status==='self_reported')return '입 주변을 잘 확인할 수 있는 사진이에요';
  return '선택한 부위가 잘 보이는 사진이에요';
}

function careBridge(status:CareStatus|undefined,concern:CareConcern){
  if(status==='self_reported')return '입 냄새는 사진만으로 확인할 수 없지만, 선택한 고민에 맞춰 매일 실천하기 좋은 구강 관리 제품을 안내해요.';
  if(status==='clear')return `사진에서 뚜렷한 특이점은 보이지 않아요. ${concern.label} 고민을 위한 일상 관리로 편안하게 이어가 보세요.`;
  return `사진에서 확인한 특징과 ${concern.label} 고민을 바탕으로 집에서 시작하기 좋은 관리 방법을 안내해요.`;
}

function canvasBlob(canvas:HTMLCanvasElement,quality:number){return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('사진을 변환하지 못했어요.')),'image/jpeg',quality))}
async function compressImage(source:File){
  const bitmap=await createImageBitmap(source,{imageOrientation:'from-image'});let scale=Math.min(1,MAX_EDGE/Math.max(bitmap.width,bitmap.height));let blob:Blob|null=null;
  for(let round=0;round<4;round+=1){const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const context=canvas.getContext('2d');if(!context)throw new Error('사진을 처리할 수 없는 브라우저예요.');context.fillStyle='#fffaf2';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);for(const quality of [.86,.76,.66,.56]){blob=await canvasBlob(canvas,quality);if(blob.size<=TARGET_BYTES)break}if(blob&&blob.size<=TARGET_BYTES)break;scale*=.78}
  bitmap.close();if(!blob)throw new Error('사진을 압축하지 못했어요.');return new File([blob],source.name.replace(/\.[^.]+$/,'')+'-optimized.jpg',{type:'image/jpeg'});
}

export default function Home(){
  const [step,setStep]=useState<Step>('charm-upload');const [charmFile,setCharmFile]=useState<File|null>(null);const [careFile,setCareFile]=useState<File|null>(null);const [charmPreview,setCharmPreview]=useState('');const [carePreview,setCarePreview]=useState('');const [charmResult,setCharmResult]=useState<AnalysisResponse|null>(null);const [careResult,setCareResult]=useState<AnalysisResponse|null>(null);const [concern,setConcern]=useState<CareConcern|null>(null);const [error,setError]=useState('');const [preparing,setPreparing]=useState(false);const requestRef=useRef<AbortController|null>(null);
  useEffect(()=>()=>requestRef.current?.abort(),[]);
  useEffect(()=>{const context=document.modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();void Promise.resolve(context.registerTool({name:'select_pet_care_concern',title:'반려동물 고민 선택',description:'현재 보이는 걱정 선택 화면에서 관리하고 싶은 항목을 선택하고 부위 사진 단계로 이동합니다.',inputSchema:{type:'object',properties:{concernId:{type:'string',enum:concerns.map(item=>item.id)}},required:['concernId'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){const id=typeof input==='object'&&input!==null?'concernId' in input?String((input as {concernId:unknown}).concernId):'':'';const item=concerns.find(candidate=>candidate.id===id);if(!item)throw new Error('지원하지 않는 걱정 항목이에요.');chooseConcern(item);return {selectedConcern:item.label,nextStep:'care-photo-upload'}}},{signal:lifecycle.signal})).catch(()=>undefined);return()=>lifecycle.abort()},[carePreview]);
  async function selectPhoto(event:ChangeEvent<HTMLInputElement>,type:AnalysisType){const source=event.target.files?.[0];event.target.value='';if(!source)return;setError('');if(!ALLOWED_TYPES.includes(source.type))return setError('JPG, PNG, WebP 사진만 사용할 수 있어요.');if(source.size>MAX_SOURCE_BYTES)return setError('원본 사진은 10MB 이하로 선택해주세요.');try{setPreparing(true);const optimized=await compressImage(source);const preview=URL.createObjectURL(optimized);if(type==='charm'){if(charmPreview)URL.revokeObjectURL(charmPreview);setCharmFile(optimized);setCharmPreview(preview)}else{if(carePreview)URL.revokeObjectURL(carePreview);setCareFile(optimized);setCarePreview(preview)}}catch(cause){setError(cause instanceof Error?cause.message:'사진을 준비하지 못했어요.')}finally{setPreparing(false)}}
  async function analyze(type:AnalysisType){const file=type==='charm'?charmFile:careFile;if(!file)return setError('먼저 사진을 선택해주세요.');setError('');setStep(type==='charm'?'charm-analyzing':'care-analyzing');const form=new FormData();form.append('photo',file);form.append('analysisType',type);if(concern)form.append('concern',concern.id);const controller=new AbortController();requestRef.current=controller;try{const response=await fetch('/api/analyze-image',{method:'POST',body:form,signal:controller.signal});const payload=await response.json() as AnalysisResponse&{error?:string};if(!response.ok)throw new Error(payload.error||'분석 요청에 실패했어요.');if(payload.imageQuality==='retry'||!payload.petDetected||(type==='care'&&payload.targetVisible===false))throw new Error(retryMessage(payload));if(type==='charm'){setCharmResult(payload);setStep('charm-result')}else{setCareResult(payload);setStep('care-result')}}catch(cause){setError(cause instanceof Error&&cause.name!=='AbortError'?cause.message:'분석이 중단됐어요.');setStep(type==='charm'?'charm-upload':'care-upload')}finally{requestRef.current=null}}
  function chooseConcern(item:CareConcern){setConcern(item);setCareFile(null);if(carePreview)URL.revokeObjectURL(carePreview);setCarePreview('');setError('');setStep('care-upload')}
  function reset(){requestRef.current?.abort();if(charmPreview)URL.revokeObjectURL(charmPreview);if(carePreview)URL.revokeObjectURL(carePreview);setCharmFile(null);setCareFile(null);setCharmPreview('');setCarePreview('');setCharmResult(null);setCareResult(null);setConcern(null);setError('');setStep('charm-upload')}
  const preview=step.startsWith('care')?carePreview:charmPreview;const analysisType:AnalysisType=step.startsWith('care')?'care':'charm';const isUpload=step==='charm-upload'||step==='care-upload';const isAnalyzing=step==='charm-analyzing'||step==='care-analyzing';
  return <main className="app-shell"><header className="brandbar"><button className={`icon-button ${step==='charm-upload'?'is-hidden':''}`} onClick={()=>setStep(step.startsWith('care')?'concern':'charm-upload')} aria-label="이전 화면" tabIndex={step==='charm-upload'?-1:0}><ArrowLeft/></button><a className="brand" href="#" onClick={event=>{event.preventDefault();reset()}} aria-label="처음으로"><img className="brand-logo" src="/asset/images/jayu-pet-logo.png" alt="JAYU PET"/></a><span className="privacy">사진은 저장하지 않아요</span></header>
  {(isUpload||isAnalyzing)&&<section className={`photo-stage screen-enter ${analysisType==='charm'?'first-upload':''}`}>{analysisType==='care'&&<div className="stage-copy"><h1>{concern?.label??'고민 부위'}가 잘 보이는 사진</h1><p>{concern?.guide}</p></div>}<div className={`photo-frame ${preview?'has-photo':''}`}>{preview?<img src={preview} alt="선택한 반려동물 사진 미리보기"/>:<div className="empty-photo"><ImagePlus/><strong>반려동물 사진을 촬영하거나 선택해주세요</strong>{analysisType==='charm'&&<span className="photo-guide">얼굴·상반신·전신 사진 모두 좋아요</span>}<span>JPG · PNG · WebP / 최대 10MB</span></div>}<span className="focus-corner corner-a"/><span className="focus-corner corner-b"/><span className="focus-corner corner-c"/><span className="focus-corner corner-d"/>{isAnalyzing&&<div className="scan-overlay"><span className="scan-line"/><Sparkles/><strong>사진을 분석하고 있어요</strong><small>잠시만 기다려주세요</small></div>}</div>{isUpload&&<><div className="photo-actions"><PhotoInput label="사진 촬영" icon={<Camera/>} capture onChange={event=>selectPhoto(event,analysisType)} disabled={preparing}/><PhotoInput label="앨범에서 선택" icon={<Upload/>} onChange={event=>selectPhoto(event,analysisType)} disabled={preparing}/></div>{preview&&<button className="primary-button" onClick={()=>analyze(analysisType)} disabled={preparing}>{preparing?'사진 준비 중…':'이 사진 분석하기'} <Sparkles/></button>}</>}{error&&<div className="error-message" role="alert">{error}</div>}</section>}
  {step==='charm-result'&&charmResult&&<section className="result-stage screen-enter"><div className="result-photo"><img src={charmPreview} alt="분석한 반려동물"/></div><div className="result-content"><span className="step-label">AI가 찾은 우리 아이의 매력</span><h1>{charmResult.compliment||'보기만 해도 미소가 나는 사랑스러운 아이예요!'}</h1><div className="trait-list">{(charmResult.visibleTraits||[]).slice(0,3).map(item=><span key={`${item.category}-${item.trait}`}><Sparkles/>{item.trait}</span>)}</div><p className="mode-note">{charmResult.mode==='mock'?'현재는 샘플 분석 모드예요.':'사진에서 보이는 특징만 살펴봤어요.'}</p><button className="primary-button" onClick={()=>setStep('concern')}>걱정거리 선택하기</button></div></section>}
  {step==='concern'&&<section className="concern-stage screen-enter"><div className="stage-copy"><span className="step-label">요즘 가장 신경 쓰이는 한 가지</span><h1>우리 아이의 어떤 점이 걱정되나요?</h1></div><div className="concern-grid">{concerns.map(item=><button key={item.id} onClick={()=>chooseConcern(item)}><span className={`concern-icon ${'image' in item?'has-image':''}`}>{'image' in item?<img src={item.image} alt=""/>:'〰'}</span><span><strong>{item.label}</strong><small>{item.description}</small></span>{item.badge&&<em>{item.badge}</em>}</button>)}</div></section>}
  {step==='care-result'&&careResult&&<section className="care-result screen-enter"><div className="result-photo"><img src={carePreview} alt="분석한 고민 부위"/></div><div className="result-content care-result-content"><span className="step-label">AI가 사진에서 확인한 점</span><h1>{careResultHeading(careResult.careStatus)}</h1><p className="summary">{careResult.rawSummary||'선택한 부위에서 눈에 보이는 특징을 정리했어요.'}</p><div className="observation-card"><strong>사진에서 보이는 특징</strong>{(careResult.visibleObservations||[]).map(item=><span key={item}><Check/>{item}</span>)}</div>{careResult.careStatus==='caution'?<div className="care-caution" role="alert"><strong>제품 사용 전에 전문가에게 확인해주세요</strong><p>사진에서 주의가 필요한 모습이 보여요. 수의사 등 전문가의 확인을 먼저 권장해요.</p></div>:concern&&<><div className="care-recommendation"><span className="step-label">이 고민에는 이렇게 관리해보세요</span><p>{careBridge(careResult.careStatus,concern)}</p></div><div className="product-card"><div className="product-image"><img src={concern.productImage} alt={concern.productName}/></div><div className="product-copy"><span className="step-label">추천 케어 제품</span><h2>{concern.productName}</h2><p>{concern.appealPoint}</p><a className="product-button" href={concern.productUrl} target="_blank" rel="noopener noreferrer">제품 상세보기</a></div></div></>}<p className="mode-note care-disclaimer">이 결과는 사진에서 보이는 특징을 정리한 것으로, 질병을 진단하거나 치료를 대신하지 않아요.</p><div className="result-actions"><button className="primary-button" onClick={reset}>처음부터 다시 하기</button><button className="text-button" onClick={()=>setStep('care-upload')}><RefreshCcw/> 부위 사진 다시 선택</button></div></div></section>}</main>
}

function PhotoInput({label,icon,capture=false,onChange,disabled}:{label:string;icon:ReactNode;capture?:boolean;onChange:(event:ChangeEvent<HTMLInputElement>)=>void;disabled:boolean}){return <label className={`photo-input ${disabled?'disabled':''}`}>{icon}<span>{label}</span><input type="file" accept="image/jpeg,image/png,image/webp" capture={capture?'environment':undefined} onChange={onChange} disabled={disabled}/></label>}

