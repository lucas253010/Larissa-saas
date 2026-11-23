/* Módulos adicionais do painel Larissa. Requer supabase-melhorias.sql. */
(()=>{
  const $x=id=>document.getElementById(id), extras=['cadastro','configuracoes'];
  let patients=[], settings=null;
  const escx=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const msg=(id,t)=>{const e=$x(id);if(e)e.textContent=t||''};
  const brlx=n=>'R$ '+Number(n||0).toFixed(2).replace('.',',');
  const showTab=(key)=>{['hoje','novas','prox','cob','pac','blq',...extras].forEach(k=>{const p=$x('p-'+k);if(p)p.hidden=k!==key});document.querySelectorAll('.tab[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===key)));};
  try{montaTabs()}catch(e){console.warn('Não foi possível montar a navegação.',e)}
  document.addEventListener('click',e=>{
    const t=e.target.closest('[data-tab]');
    if(t){if(extras.includes(t.dataset.tab))showTab(t.dataset.tab);else extras.forEach(k=>{const p=$x('p-'+k);if(p)p.hidden=true});}
  });
  const ready=()=>!$('app').hidden;
  async function loadPatients(){
    const {data,error}=await sb.from('pacientes').select('*').order('nome');
    if(error){msg('pac-msg','Aplique primeiro a migração SQL do projeto: '+error.message);return}
    patients=data||[];
    const sel=$x('form-consulta').elements.paciente_id;
    sel.innerHTML='<option value="">Selecione um paciente</option>'+patients.map(p=>'<option value="'+escx(p.id)+'">'+escx(p.nome)+'</option>').join('');
    await loadConsultOptions();
  }
  const defaultConsultValue=()=>Number(settings?.valor??CFG.VALOR??180);
  async function loadConsultOptions(){
    const f=$x('form-consulta'),hora=f.elements.hora;
    hora.innerHTML=(CFG.HORAS||[]).map(h=>'<option>'+escx(h)+'</option>').join('');
    if(!f.elements.valor.dataset.userEdited)f.elements.valor.value=defaultConsultValue();
  }
  async function loadSettings(){
    const {data,error}=await sb.from('configuracoes_painel').select('*').eq('id',1).maybeSingle();
    if(error){msg('config-msg','Configurações indisponíveis: '+error.message);return}
    settings=data||{};
    const f=$x('form-config');
    f.elements.nome.value=settings.nome||CFG.NOME||'';
    f.elements.crp.value=settings.crp||CFG.CRP||'';
    f.elements.valor.value=defaultConsultValue();
    delete $x('form-consulta').elements.valor.dataset.userEdited;
    f.elements.duracao.value=settings.duracao_minutos||50;
    f.elements.horas.value=(settings.horas||CFG.HORAS||[]).join('\n');
    f.querySelectorAll('[name="dias"]').forEach(c=>c.checked=(settings.dias_atendimento||CFG.DIAS_ATENDIMENTO||[1,2,3,4,5]).includes(Number(c.value)));
  }
  $x('form-paciente').addEventListener('submit',async e=>{
    e.preventDefault();const f=e.currentTarget;
    const payload={nome:f.elements.nome.value.trim(),whatsapp:f.elements.whatsapp.value.trim()||null,email:f.elements.email.value.trim()||null};
    const {error}=await sb.from('pacientes').insert(payload);
    if(error)return msg('pac-msg','Não foi possível salvar: '+error.message);
    f.reset();msg('pac-msg','Paciente cadastrado.');await loadPatients();
  });
  $x('form-consulta').elements.valor.addEventListener('input',e=>{e.currentTarget.dataset.userEdited='true'});
  $x('form-consulta').addEventListener('submit',async e=>{
    e.preventDefault();const f=e.currentTarget,p=patients.find(x=>x.id===f.elements.paciente_id.value);if(!p)return msg('cons-msg','Selecione um paciente.');
    const payload={paciente_id:p.id,data:f.elements.data.value,hora:f.elements.hora.value,nome:p.nome,whatsapp:p.whatsapp,modalidade:f.elements.modalidade.value,status:f.elements.status.value,valor:Number(f.elements.valor.value||defaultConsultValue()),pago:false};
    const {error}=await sb.from('consultas').insert(payload);
    if(error)return msg('cons-msg','Não foi possível criar a consulta: '+error.message);
    f.reset();delete f.elements.valor.dataset.userEdited;f.elements.valor.value=defaultConsultValue();msg('cons-msg','Consulta criada.');await loadConsultOptions();await carregar();
  });
  $x('form-config').addEventListener('submit',async e=>{
    e.preventDefault();const f=e.currentTarget;
    const horas=f.elements.horas.value.split(/\n|,/).map(x=>x.trim()).filter(x=>/^([01]\d|2[0-3]):[0-5]\d$/.test(x));
    if(!horas.length)return msg('config-msg','Informe pelo menos um horário válido (HH:MM).');
    const payload={id:1,nome:f.elements.nome.value.trim(),crp:f.elements.crp.value.trim(),valor:Number(f.elements.valor.value),duracao_minutos:Number(f.elements.duracao.value||50),horas,dias_atendimento:[...f.querySelectorAll('[name="dias"]:checked')].map(x=>Number(x.value)),atualizado_em:new Date().toISOString()};
    const {error}=await sb.from('configuracoes_painel').upsert(payload);
    if(error)return msg('config-msg','Erro ao salvar configurações: '+error.message);
    settings=payload;
    const valorConsulta=$x('form-consulta').elements.valor;
    if(!valorConsulta.dataset.userEdited)valorConsulta.value=defaultConsultValue();
    msg('config-msg','Configurações salvas. Novas consultas usarão '+brlx(payload.valor)+' como valor padrão.');
  });
  const originalCarregar=carregar;
  carregar=async function(){await originalCarregar();if(ready()){await loadPatients();await loadSettings()}};
  const observer=new MutationObserver(async()=>{if(ready()){await loadPatients();await loadSettings()}});
  observer.observe($x('app'),{attributes:true,attributeFilter:['hidden']});
  $x('form-consulta').elements.valor.value=defaultConsultValue();
})();