/* Espaço de sessão clínica — registros vinculados a cada consulta. */
(()=>{
  const $s=id=>document.getElementById(id);
  const form=$s('form-sessao');
  if(!form)return;
  let consultaAtual=null, pacienteAtual=null, anotacaoAtual=null;
  const normS=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const safeS=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateS=s=>s?new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}):'';
  const setMsg=(t)=>{$s('sessao-salvo').textContent=t};
  const field=n=>form.elements[n];
  const readForm=()=>({
    conteudo:field('conteudo').value.trim(),
    humor:field('humor').value||null,
    temas:field('temas').value.trim()||null,
    intervencoes:field('intervencoes').value.trim()||null,
    tarefas:field('tarefas').value.trim()||null,
    plano:field('plano').value.trim()||null
  });
  const fillForm=a=>{
    const x=a||{};
    ['conteudo','humor','temas','intervencoes','tarefas','plano'].forEach(k=>field(k).value=x[k]||'');
  };
  function showArea(){
    if(typeof trocaAba==='function')trocaAba('sessao');
    $s('p-sessao').hidden=false;
    document.querySelectorAll('.tab[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab==='sessao')));
    $s('p-sessao').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }
  async function pacienteDaConsulta(r){
    if(demoOn)return {nome:r.nome,whatsapp:r.whatsapp||'',email:'',id:r.paciente_id||null};
    const {data,error}=await sb.from('pacientes').select('id,nome,whatsapp,email');
    if(error)return {nome:r.nome,whatsapp:r.whatsapp||'',email:'',id:r.paciente_id||null};
    const tel=String(r.whatsapp||'').replace(/\D/g,'');
    return (data||[]).find(p=>r.paciente_id&&String(p.id)===String(r.paciente_id))
      ||(data||[]).find(p=>tel&&String(p.whatsapp||'').replace(/\D/g,'')===tel)
      ||(data||[]).find(p=>normS(p.nome)===normS(r.nome))
      ||{nome:r.nome,whatsapp:r.whatsapp||'',email:'',id:r.paciente_id||null};
  }
  function renderPaciente(p,r){
    const dados=[
      ['Paciente',p.nome||r.nome||'—'],
      ['Telefone',p.whatsapp||r.whatsapp||'Não informado'],
      ['E-mail',p.email||'Não informado'],
      ['Atendimento',(r.modalidade||'')+' · '+String(r.hora||'').slice(0,5)]
    ];
    $s('sessao-paciente').innerHTML='<div class="sessao-paciente-grid">'+dados.map(([k,v])=>'<div><span>'+safeS(k)+'</span><b>'+safeS(v)+'</b></div>').join('')+'</div>';
    $s('sessao-titulo').textContent='Sessão · '+(p.nome||r.nome);
    $s('sessao-subtitulo').textContent=dateS(r.data)+' · '+(r.status||'Consulta')+(r.presenca?' · '+r.presenca:'');
    $s('sessao-status').textContent=r.data===ymd(new Date())?'Sessão de hoje':'Registro da consulta';
  }
  async function loadHistory(){
    const rel=(dados()||[]).filter(x=>{
      const t=String(x.whatsapp||'').replace(/\D/g,'');
      const current=String(consultaAtual.whatsapp||'').replace(/\D/g,'');
      return (current&&t===current)||(!current&&normS(x.nome)===normS(consultaAtual.nome));
    }).sort((a,b)=>(b.data+String(b.hora)).localeCompare(a.data+String(a.hora)));
    if(!rel.length){$s('sessao-historico-lista').innerHTML='<p class="mut">Nenhuma outra sessão encontrada.</p>';return}
    if(demoOn){
      const anteriores=rel.filter(x=>String(x.id)!==String(consultaAtual.id));
      $s('sessao-historico-lista').innerHTML=anteriores.map(x=>{
        const n=x._anotacao;
        return '<details class="sessao-historico-item"><summary><b>'+safeS(dateS(x.data))+'</b><span class="mut">'+safeS(String(x.hora||'').slice(0,5))+' · '+(n?'Exemplo preenchido':'Sem anotação')+'</span></summary>'+
          (n?'<p><b>Humor:</b> '+safeS(n.humor||'Não registrado')+'</p><p><b>Temas:</b> '+safeS(n.temas||'Não registrados')+'</p><p>'+safeS(n.conteudo||'')+'</p>'+(n.intervencoes?'<p><b>Intervenções:</b> '+safeS(n.intervencoes)+'</p>':'')+(n.tarefas?'<p><b>Combinados:</b> '+safeS(n.tarefas)+'</p>':'')+(n.plano?'<p><b>Retomar:</b> '+safeS(n.plano)+'</p>':''):'<p class="mut">Esta consulta de demonstração não possui anotação de exemplo.</p>')+'</details>';
      }).join('')||'<p class="mut">Este é o primeiro registro de sessão deste paciente.</p>';
      return;
    }
    const ids=rel.map(x=>x.id);
    const {data,error}=await sb.from('anotacoes_consultas').select('consulta_id,conteudo,humor,temas,intervencoes,tarefas,plano,atualizado_em').in('consulta_id',ids);
    if(error){$s('sessao-historico-lista').innerHTML='<p class="mut">Não foi possível carregar o histórico. Verifique se a migração da área de sessão foi aplicada.</p>';return}
    const byId=new Map((data||[]).map(n=>[String(n.consulta_id),n]));
    const itens=rel.filter(x=>String(x.id)!==String(consultaAtual.id));
    $s('sessao-historico-lista').innerHTML=itens.length?itens.map(x=>{
      const n=byId.get(String(x.id));
      return '<details class="sessao-historico-item"><summary><b>'+safeS(dateS(x.data))+'</b><span class="mut">'+safeS(String(x.hora||'').slice(0,5))+' · '+(n?'Registro salvo':'Sem anotação')+'</span></summary>'+
        (n?'<p>'+safeS(n.conteudo||'Sem evolução registrada')+'</p>'+'<p class="mut">'+(n.humor?'Humor: '+safeS(n.humor)+' · ':'')+(n.temas?'Temas: '+safeS(n.temas):'')+'</p>':'<p class="mut">Nenhuma anotação salva nesta consulta.</p>')+'</details>';
    }).join(''):'<p class="mut">Este é o primeiro registro de sessão deste paciente.</p>';
  }
  async function openSession(id){
    const r=(dados()||[]).find(x=>String(x.id)===String(id));
    if(!r){alert('Não encontrei esta consulta na agenda.');return}
    consultaAtual=r;
    anotacaoAtual=null;
    form.reset();
    field('consulta_id').value=r.id;
    setMsg('Carregando registro…');
    showArea();
    pacienteAtual=await pacienteDaConsulta(r);
    renderPaciente(pacienteAtual,r);
    if(demoOn){
      anotacaoAtual=r._anotacao||null;
      fillForm(anotacaoAtual);
      setMsg(anotacaoAtual?'Exemplo fictício · não salvo no banco':'Modo de demonstração · não salva no banco');
      await loadHistory();
      return;
    }
    const {data,error}=await sb.from('anotacoes_consultas').select('*').eq('consulta_id',r.id).maybeSingle();
    if(error){setMsg('Erro ao carregar. Aplique a migração SQL.');alert('Não foi possível carregar o registro: '+error.message);return}
    anotacaoAtual=data||null;
    fillForm(anotacaoAtual);
    setMsg(data?'Último salvamento: '+new Date(data.atualizado_em||data.criado_em).toLocaleString('pt-BR'):'Ainda não salvo');
    await loadHistory();
  }
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!consultaAtual)return;
    const payload={consulta_id:consultaAtual.id,...readForm()};
    if(demoOn){consultaAtual._anotacao=payload;anotacaoAtual=payload;setMsg('Salvo apenas nesta demonstração');return}
    const btn=$s('sessao-salvar');btn.disabled=true;btn.textContent='Salvando…';
    const {data,error}=await sb.from('anotacoes_consultas').upsert(payload,{onConflict:'consulta_id'}).select().single();
    btn.disabled=false;btn.textContent='Salvar registro';
    if(error){setMsg('Falha ao salvar');alert('Não foi possível salvar o registro: '+error.message);return}
    anotacaoAtual=data;setMsg('Salvo em '+new Date(data.atualizado_em||data.criado_em).toLocaleString('pt-BR'));
    $s('sessao-status').textContent='Registro salvo';
    await loadHistory();
    document.querySelectorAll('details[data-k][open]').forEach(d=>loadPatientNotes(d));
  });
  $s('sessao-limpar').addEventListener('click',()=>{
    if(!confirm('Limpar os campos desta tela? O que já foi salvo no banco não será apagado.'))return;
    fillForm(null);setMsg('Campos limpos · ainda não salvos');
  });
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-a="sessao"]');
    if(b){e.preventDefault();openSession(b.dataset.id)}
  });

  async function loadPatientNotes(root){
    const nodes=[...(root||document).querySelectorAll('[data-nota-consulta]')];
    const ids=nodes.map(n=>n.dataset.notaConsulta).filter(Boolean);
    if(!ids.length)return;
    if(demoOn){
      const map=new Map((dados()||[]).map(r=>[String(r.id),r._anotacao||null]));
      nodes.forEach(n=>{
        const a=map.get(String(n.dataset.notaConsulta));
        n.innerHTML=a?'<b>Exemplo fictício · anotação da sessão</b><p>'+safeS(a.conteudo||'')+'</p>'+(a.intervencoes?'<p><b>Intervenções:</b> '+safeS(a.intervencoes)+'</p>':'')+(a.plano?'<p><b>Próximos passos:</b> '+safeS(a.plano)+'</p>':''):'<span class="mut">Nenhuma anotação salva nesta consulta.</span>';
      });
      return;
    }
    const {data,error}=await sb.from('anotacoes_consultas').select('consulta_id,conteudo,humor,temas,intervencoes,tarefas,plano').in('consulta_id',ids);
    if(error){nodes.forEach(n=>n.innerHTML='<span class="mut">Não foi possível carregar a anotação. Verifique a migração SQL.</span>');return}
    const map=new Map((data||[]).map(a=>[String(a.consulta_id),a]));
    nodes.forEach(n=>{
      const a=map.get(String(n.dataset.notaConsulta));
      n.innerHTML=a?'<b>Registro clínico</b>'+(a.humor?'<p><b>Humor:</b> '+safeS(a.humor)+'</p>':'')+(a.temas?'<p><b>Temas:</b> '+safeS(a.temas)+'</p>':'')+(a.conteudo?'<p>'+safeS(a.conteudo)+'</p>':'')+(a.intervencoes?'<p><b>Intervenções:</b> '+safeS(a.intervencoes)+'</p>':'')+(a.tarefas?'<p><b>Combinados:</b> '+safeS(a.tarefas)+'</p>':'')+(a.plano?'<p><b>Retomar:</b> '+safeS(a.plano)+'</p>':''):'<span class="mut">Nenhuma anotação salva nesta consulta.</span>';
    });
  }
  document.addEventListener('toggle',e=>{
    const d=e.target;
    if(d&&d.matches&&d.matches('details[data-k]')&&d.open)loadPatientNotes(d);
  },true);
  window.carregarNotasPaciente=loadPatientNotes;

  window.abrirSessaoClinica=openSession;
})();
