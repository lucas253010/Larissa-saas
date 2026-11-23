/* Módulos adicionais do painel Larissa. Requer supabase-melhorias.sql. */
(()=>{
  const $x=id=>document.getElementById(id), extras=['cadastro','prontuarios','financeiro','configuracoes'];
  let patients=[], selectedNote=null, noteId=null, settings=null;
  const escx=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const msg=(id,t)=>{const e=$x(id);if(e)e.textContent=t||''};
  const dateNow=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const brlx=n=>'R$ '+Number(n||0).toFixed(2).replace('.',',');
  const showTab=(key)=>{['hoje','novas','prox','cob','pac','blq',...extras].forEach(k=>{const p=$x('p-'+k);if(p)p.hidden=k!==key});document.querySelectorAll('.tab[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===key)));};
  try{
    TABS.push(['cadastro','Cadastro','users',''],['prontuarios','Prontuários','receipt',''],['financeiro','Financeiro','wallet',''],['configuracoes','Configurações','lock','']);
    montaTabs();
  }catch(e){console.warn('Não foi possível adicionar as abas extras.',e)}
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
  async function loadConsultOptions(){
    const sel=$x('nota-consulta');
    const {data,error}=await sb.from('consultas').select('id,data,hora,nome,status').order('data',{ascending:false}).order('hora',{ascending:false}).limit(500);
    if(error){msg('nota-msg','Não foi possível carregar consultas: '+error.message);return}
    sel.innerHTML='<option value="">Selecione uma consulta</option>'+(data||[]).map(r=>'<option value="'+escx(r.id)+'">'+escx(r.data)+' · '+escx(String(r.hora).slice(0,5))+' · '+escx(r.nome)+' · '+escx(r.status)+'</option>').join('');
    const hora=$x('form-consulta').elements.hora;
    hora.innerHTML=(CFG.HORAS||[]).map(h=>'<option>'+escx(h)+'</option>').join('');
  }
  async function loadSettings(){
    const {data,error}=await sb.from('configuracoes_painel').select('*').eq('id',1).maybeSingle();
    if(error){msg('config-msg','Configurações indisponíveis: '+error.message);return}
    settings=data||{};
    const f=$x('form-config');
    f.elements.nome.value=settings.nome||CFG.NOME||'';
    f.elements.crp.value=settings.crp||CFG.CRP||'';
    f.elements.valor.value=settings.valor??CFG.VALOR??180;
    f.elements.duracao.value=settings.duracao_minutos||50;
    f.elements.horas.value=(settings.horas||CFG.HORAS||[]).join('\n');
    f.querySelectorAll('[name="dias"]').forEach(c=>c.checked=(settings.dias_atendimento||CFG.DIAS_ATENDIMENTO||[1,2,3,4,5]).includes(Number(c.value)));
  }
  async function loadNote(id){
    selectedNote=id;noteId=null;$x('nota-texto').value='';$x('nota-historico').innerHTML='';
    if(!id)return;
    const {data,error}=await sb.from('anotacoes_consultas').select('*').eq('consulta_id',id).maybeSingle();
    if(error){msg('nota-msg','Tabela de anotações indisponível. Aplique a migração SQL. '+error.message);return}
    if(data){noteId=data.id;$x('nota-texto').value=data.conteudo||''}
    const {data:history,herror}=await sb.from('historico_anotacoes').select('*').eq('anotacao_id',noteId||'00000000-0000-0000-0000-000000000000').order('criado_em',{ascending:false}).limit(20);
    if(herror){msg('nota-msg','Não foi possível carregar versões anteriores: '+herror.message);return}
    $x('nota-historico').innerHTML=(history||[]).map(v=>'<div class="note-version"><strong>Versão anterior · '+new Date(v.criado_em).toLocaleString('pt-BR')+'</strong><p>'+escx(v.conteudo)+'</p></div>').join('');
    msg('nota-msg',data?'Registro carregado.':'Ainda não há anotação para esta consulta.');
  }
  $x('nota-consulta').addEventListener('change',e=>loadNote(e.target.value));
  $x('nota-salvar').addEventListener('click',async()=>{
    if(!selectedNote)return msg('nota-msg','Selecione uma consulta.');
    const conteudo=$x('nota-texto').value.trim();if(!conteudo)return msg('nota-msg','Escreva a anotação antes de salvar.');
    const payload={consulta_id:selectedNote,conteudo};
    const result=noteId?await sb.from('anotacoes_consultas').update({conteudo,atualizado_em:new Date().toISOString()}).eq('id',noteId).select().single():await sb.from('anotacoes_consultas').insert(payload).select().single();
    if(result.error)return msg('nota-msg','Erro ao salvar. Verifique a migração e as permissões: '+result.error.message);
    noteId=result.data.id;msg('nota-msg','Anotação salva com segurança em '+new Date().toLocaleString('pt-BR')+'.');
    await loadNote(selectedNote);
  });
  $x('form-paciente').addEventListener('submit',async e=>{
    e.preventDefault();const f=e.currentTarget;
    const payload={nome:f.elements.nome.value.trim(),whatsapp:f.elements.whatsapp.value.trim()||null,email:f.elements.email.value.trim()||null};
    const {error}=await sb.from('pacientes').insert(payload);
    if(error)return msg('pac-msg','Não foi possível salvar: '+error.message);
    f.reset();msg('pac-msg','Paciente cadastrado.');await loadPatients();
  });
  $x('form-consulta').addEventListener('submit',async e=>{
    e.preventDefault();const f=e.currentTarget,p=patients.find(x=>x.id===f.elements.paciente_id.value);if(!p)return msg('cons-msg','Selecione um paciente.');
    const payload={paciente_id:p.id,data:f.elements.data.value,hora:f.elements.hora.value,nome:p.nome,whatsapp:p.whatsapp,modalidade:f.elements.modalidade.value,status:f.elements.status.value,valor:Number(f.elements.valor.value||CFG.VALOR||180),pago:false};
    const {error}=await sb.from('consultas').insert(payload);
    if(error)return msg('cons-msg','Não foi possível criar a consulta: '+error.message);
    f.reset();f.elements.valor.value=CFG.VALOR||180;msg('cons-msg','Consulta criada.');await loadConsultOptions();await carregar();
  });
  $x('form-config').addEventListener('submit',async e=>{
    e.preventDefault();const f=e.currentTarget;
    const horas=f.elements.horas.value.split(/\n|,/).map(x=>x.trim()).filter(x=>/^([01]\d|2[0-3]):[0-5]\d$/.test(x));
    if(!horas.length)return msg('config-msg','Informe pelo menos um horário válido (HH:MM).');
    const payload={id:1,nome:f.elements.nome.value.trim(),crp:f.elements.crp.value.trim(),valor:Number(f.elements.valor.value),duracao_minutos:Number(f.elements.duracao.value||50),horas,dias_atendimento:[...f.querySelectorAll('[name="dias"]:checked')].map(x=>Number(x.value)),atualizado_em:new Date().toISOString()};
    const {error}=await sb.from('configuracoes_painel').upsert(payload);
    if(error)return msg('config-msg','Erro ao salvar configurações: '+error.message);
    msg('config-msg','Configurações salvas no painel. A agenda pública ainda precisa de sincronização em config.js.');
  });
  const renderFinance=()=>{
    const m=$x('fin-mes').value||dateNow().slice(0,7),list=(rows||[]).filter(r=>String(r.data).slice(0,7)===m&&r.status!=='Cancelada');
    const paid=list.filter(r=>r.pago).reduce((a,r)=>a+Number(r.valor||0),0),due=list.filter(r=>!r.pago).reduce((a,r)=>a+Number(r.valor||0),0);
    $x('fin-kpis').innerHTML=[['Recebido',brlx(paid)],['A receber',brlx(due)],['Sessões',list.length]].map(([a,b])=>'<div class="extra-kpi"><span>'+a+'</span><strong>'+b+'</strong></div>').join('');
    $x('fin-lista').innerHTML=list.length?list.sort((a,b)=>(a.data+a.hora).localeCompare(b.data+b.hora)).map(r=>'<div class="row"><span>'+escx(r.data)+' · '+escx(String(r.hora).slice(0,5))+' · '+escx(r.nome)+'</span><strong>'+brlx(r.valor)+' · '+(r.pago?'Pago':'Pendente')+'</strong></div>').join(''):'<p class="mut">Nenhuma sessão neste mês.</p>';
  };
  $x('fin-mes').value=dateNow().slice(0,7);$x('fin-mes').addEventListener('change',renderFinance);
  $x('fin-csv').addEventListener('click',()=>{
    const m=$x('fin-mes').value, list=(rows||[]).filter(r=>String(r.data).slice(0,7)===m&&r.status!=='Cancelada');
    const lines=[['Data','Hora','Paciente','Modalidade','Status','Pagamento','Valor'],...list.map(r=>[r.data,String(r.hora).slice(0,5),r.nome,r.modalidade,r.status,r.pago?'Pago':'Pendente',Number(r.valor||0).toFixed(2)])];
    const csv='\ufeff'+lines.map(a=>a.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='financeiro-'+m+'.csv';a.click();URL.revokeObjectURL(url);
  });
  const originalCarregar=carregar;
  carregar=async function(){await originalCarregar();if(ready()){await loadPatients();await loadSettings();renderFinance()}};
  const observer=new MutationObserver(async()=>{if(ready()){await loadPatients();await loadSettings();renderFinance()}});
  observer.observe($x('app'),{attributes:true,attributeFilter:['hidden']});
  $x('form-consulta').elements.valor.value=CFG.VALOR||180;
  window.addEventListener('focus',()=>{if(ready())renderFinance()});
})();