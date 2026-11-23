/* Espaço de sessão clínica — registros vinculados a cada consulta. */
(()=>{
  const $s=id=>document.getElementById(id);
  const form=$s('form-sessao');
  if(!form)return;
  let consultaAtual=null, pacienteAtual=null, anotacaoAtual=null, graficoEvolucao=null;
  const normS=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const safeS=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateS=s=>s?new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}):'';
  const setMsg=(t)=>{$s('sessao-salvo').textContent=t};
  const field=n=>form.elements[n];
  const readForm=()=>({
    conteudo:field('conteudo').value.trim(),
    humor:field('humor').value||null,
    evolucao_nota:field('evolucao_nota').value?Number(field('evolucao_nota').value):null,
    temas:field('temas').value.trim()||null,
    intervencoes:buildIntervencoes()||null,
    tarefas:field('tarefas').value.trim()||null,
    plano:field('plano').value.trim()||null
  });
  const estrategiasDisponiveis=[
    'Escuta ativa','Acolhimento emocional','Validação emocional','Empatia terapêutica',
    'Identificação de pensamentos automáticos','Questionamento de crenças','Reestruturação cognitiva','Psicoeducação',
    'Regulação emocional','Identificação de emoções','Exercícios de respiração','Mindfulness',
    'Estratégias de enfrentamento','Resolução de problemas','Treino de habilidades sociais','Exposição gradual',
    'Autoconhecimento','Estabelecimento de limites','Fortalecimento da autoestima','Reflexão sobre padrões de comportamento'
  ];
  let estrategiasMarcadas=[];
  const seletorEstrategias=$s('intervencoes-selecao');
  const listaEstrategias=$s('intervencoes-selecionadas');
  function renderEstrategias(){
    if(!listaEstrategias)return;
    listaEstrategias.innerHTML=estrategiasMarcadas.map((nome,i)=>'<span class="intervencao-chip">'+safeS(nome)+'<button type="button" data-remover-intervencao="'+i+'" aria-label="Remover '+safeS(nome)+'">×</button></span>').join('');
  }
  function buildIntervencoes(){
    const manual=field('intervencoes_manual').value.trim();
    if(!estrategiasMarcadas.length&&!manual)return '';
    return 'Intervenções selecionadas:\n'+(estrategiasMarcadas.length?estrategiasMarcadas.join('; '):'')+(manual?'\nComplemento: '+manual:'');
  }
  function parseIntervencoes(valor){
    const texto=String(valor||'');
    estrategiasMarcadas=[];
    field('intervencoes_manual').value='';
    const prefixo='Intervenções selecionadas:\n';
    if(texto.startsWith(prefixo)){
      const linhas=texto.slice(prefixo.length).split('\n');
      linhas.forEach(linha=>{
        if(linha.startsWith('Complemento: ')){field('intervencoes_manual').value=linha.slice(13);return;}
        // Compatibilidade com registros criados no seletor anterior, que salvava categorias.
        const pos=linha.indexOf(': ');
        const itens=(pos>=0?linha.slice(pos+2):linha).split(';').map(v=>v.trim()).filter(Boolean);
        itens.forEach(v=>{
          if(estrategiasDisponiveis.includes(v)&&!estrategiasMarcadas.includes(v))estrategiasMarcadas.push(v);
          else if(v)field('intervencoes_manual').value+=(field('intervencoes_manual').value?'\n':'')+v;
        });
      });
    }else if(texto){
      // Registros antigos em texto livre continuam visíveis e editáveis.
      const encontradas=estrategiasDisponiveis.filter(v=>texto.includes(v));
      estrategiasMarcadas=encontradas;
      let restante=texto;
      encontradas.forEach(v=>{restante=restante.replace(v,'');});
      field('intervencoes_manual').value=restante.replace(/[;,\n ]+$/,'').trim()||texto;
    }
    renderEstrategias();
  }
  if(seletorEstrategias){
    seletorEstrategias.addEventListener('change',()=>{
      const v=seletorEstrategias.value;
      if(v&&!estrategiasMarcadas.includes(v))estrategiasMarcadas.push(v);
      seletorEstrategias.value='';
      renderEstrategias();
      marcarAlteracao();
    });
  }
  if(listaEstrategias)listaEstrategias.addEventListener('click',e=>{
    const b=e.target.closest('[data-remover-intervencao]');
    if(!b)return;
    estrategiasMarcadas.splice(Number(b.dataset.removerIntervencao),1);
    renderEstrategias();
    marcarAlteracao();
  });
  const fillForm=a=>{
    const x=a||{};
    ['conteudo','humor','evolucao_nota','temas','tarefas','plano'].forEach(k=>field(k).value=x[k]??'');
    parseIntervencoes(x.intervencoes??'');
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
      const demoMap=new Map(rel.filter(x=>x._anotacao).map(x=>[String(x.id),x._anotacao]));
      renderEvolucao(rel,demoMap);
      const anteriores=rel.filter(x=>String(x.id)!==String(consultaAtual.id));
      $s('sessao-historico-lista').innerHTML=anteriores.map(x=>{
        const n=x._anotacao;
        return '<details class="sessao-historico-item"><summary><b>'+safeS(dateS(x.data))+'</b><span class="mut">'+safeS(String(x.hora||'').slice(0,5))+' · '+(n?'Exemplo preenchido':'Sem anotação')+'</span></summary>'+
          (n?'<p><b>Humor:</b> '+safeS(n.humor||'Não registrado')+'</p><p><b>Temas:</b> '+safeS(n.temas||'Não registrados')+'</p><p>'+safeS(n.conteudo||'')+'</p>'+(n.intervencoes?'<p><b>Intervenções:</b> '+safeS(n.intervencoes)+'</p>':'')+(n.tarefas?'<p><b>Combinados:</b> '+safeS(n.tarefas)+'</p>':'')+(n.plano?'<p><b>Retomar:</b> '+safeS(n.plano)+'</p>':''):'<p class="mut">Esta consulta de demonstração não possui anotação de exemplo.</p>')+'</details>';
      }).join('')||'<p class="mut">Este é o primeiro registro de sessão deste paciente.</p>';
      return;
    }
    const ids=rel.map(x=>x.id);
    const {data,error}=await sb.from('anotacoes_consultas').select('consulta_id,conteudo,humor,temas,intervencoes,tarefas,plano,evolucao_nota,atualizado_em').in('consulta_id',ids);
    if(error){$s('sessao-historico-lista').innerHTML='<p class="mut">Não foi possível carregar o histórico. Verifique se a migração da área de sessão foi aplicada.</p>';return}
    const byId=new Map((data||[]).map(n=>[String(n.consulta_id),n]));
    renderEvolucao(rel,byId);
    const itens=rel.filter(x=>String(x.id)!==String(consultaAtual.id));
    $s('sessao-historico-lista').innerHTML=itens.length?itens.map(x=>{
      const n=byId.get(String(x.id));
      return '<details class="sessao-historico-item"><summary><b>'+safeS(dateS(x.data))+'</b><span class="mut">'+safeS(String(x.hora||'').slice(0,5))+' · '+(n?'Registro salvo':'Sem anotação')+'</span></summary>'+
        (n?'<p>'+safeS(n.conteudo||'Sem evolução registrada')+'</p>'+'<p class="mut">'+(n.humor?'Humor: '+safeS(n.humor)+' · ':'')+(n.evolucao_nota?'Evolução: '+safeS(n.evolucao_nota)+'/5 · ':'')+(n.temas?'Temas: '+safeS(n.temas):'')+'</p>':'<p class="mut">Nenhuma anotação salva nesta consulta.</p>')+'</details>';
    }).join(''):'<p class="mut">Este é o primeiro registro de sessão deste paciente.</p>';
  }
  function renderEvolucao(rel, anotacoes){
    const canvas=$s('sessao-grafico'), vazio=$s('sessao-evolucao-vazio');
    if(!canvas||!vazio)return;
    const pontos=(rel||[]).map(r=>({r,n:anotacoes instanceof Map?anotacoes.get(String(r.id)):null}))
      .filter(x=>x.n&&Number(x.n.evolucao_nota)>=1&&Number(x.n.evolucao_nota)<=5)
      .sort((a,b)=>(a.r.data+String(a.r.hora)).localeCompare(b.r.data+String(b.r.hora)));
    if(graficoEvolucao){graficoEvolucao.destroy();graficoEvolucao=null;}
    const area=canvas.closest('.sessao-evolucao');
    let resumo=$s('sessao-evolucao-resumo');
    if(!resumo){
      resumo=document.createElement('div');resumo.id='sessao-evolucao-resumo';
      resumo.className='sessao-evolucao-resumo';
      const head=area.querySelector('.sessao-evolucao-head');
      head.insertAdjacentElement('afterend',resumo);
    }
    vazio.hidden=!!pontos.length; canvas.parentElement.hidden=!pontos.length;
    resumo.hidden=!pontos.length;
    if(!pontos.length){resumo.innerHTML='';return;}
    const notas=pontos.map(x=>Number(x.n.evolucao_nota));
    const ultima=notas[notas.length-1], media=(notas.reduce((a,b)=>a+b,0)/notas.length).toFixed(1).replace('.',',');
    const variacao=ultima-notas[0], variacaoTxt=variacao>0?'+'+variacao: String(variacao);
    const descricoes=['','Momento mais difícil','Pequenos avanços / desafios','Estável / em construção','Avanços percebidos','Avanços consistentes'];
    const tendenciaIcon=variacao>0?'↗':variacao<0?'↘':'→';
    resumo.innerHTML='<div class="sessao-evolucao-kpi destaque"><span>✦ Última avaliação</span><strong>'+ultima+'<small>/5</small></strong><em>'+descricoes[ultima]+'</em></div>'+
      '<div class="sessao-evolucao-kpi"><span>◉ Média registrada</span><strong>'+media+'<small>/5</small></strong><em>Nas avaliações preenchidas</em></div>'+
      '<div class="sessao-evolucao-kpi"><span>'+tendenciaIcon+' Variação</span><strong>'+variacaoTxt+'</strong><em>Da primeira à última nota</em></div>'+
      '<div class="sessao-evolucao-kpi"><span>▤ Avaliações</span><strong>'+pontos.length+'</strong><em>Sessões avaliadas</em></div>';
    if(!window.Chart)return;
    const datas=pontos.map(x=>new Date(x.r.data+'T12:00:00'));
    const rotulos=notas.map(n=>descricoes[n]);
    graficoEvolucao=new Chart(canvas,{type:'line',data:{
      labels:datas.map(d=>d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})),
      datasets:[{label:'Percepção clínica',data:notas,borderColor:'#98634f',backgroundColor:'rgba(163,109,85,.13)',fill:true,tension:.36,borderWidth:3,pointRadius:ctx=>ctx.dataIndex===notas.length-1?7:5,pointHoverRadius:10,pointHitRadius:16,pointStyle:ctx=>['triangle','rectRot','circle','rectRounded','star'][Math.max(0,Math.min(4,Number(ctx.raw)-1))],pointBackgroundColor:ctx=>ctx.dataIndex===notas.length-1?'#98634f':'#fffaf6',pointBorderColor:'#98634f',pointBorderWidth:2,pointHoverBackgroundColor:'#98634f',pointHoverBorderColor:'#fff',pointHoverBorderWidth:3}]
    },options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'nearest',axis:'x',intersect:false},
      animation:{duration:650,easing:'easeOutQuart'},
      layout:{padding:{top:12,right:12,bottom:2,left:4}},
      plugins:{
        legend:{display:false},
        tooltip:{displayColors:false,backgroundColor:'#38241d',titleColor:'#fffaf6',bodyColor:'#fffaf6',padding:12,cornerRadius:10,callbacks:{
          title:items=>{const d=datas[items[0].dataIndex];return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})+' · Sessão '+(items[0].dataIndex+1)},
          label:c=>['△','◇','●','▣','★'][c.parsed.y-1]+' Nota '+c.parsed.y+'/5 · '+rotulos[c.dataIndex]
        }}
      },
      scales:{
        y:{min:1,max:5,grid:{color:'rgba(128,107,97,.13)',drawBorder:false},border:{display:false},ticks:{stepSize:1,color:'#806b61',padding:9,font:{size:11},callback:v=>v+'/5'}},
        x:{grid:{display:false},border:{display:false},ticks:{autoSkip:true,maxTicksLimit:6,minRotation:0,maxRotation:0,color:'#806b61',padding:8,font:{size:11}}}
      }
    }});
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
  const botaoSalvar=$s('sessao-salvar');
  const marcarAlteracao=()=>{
    if(botaoSalvar.disabled)return;
    botaoSalvar.textContent='Salvar registro';
    botaoSalvar.classList.remove('sessao-salvo-ok');
  };
  form.addEventListener('input',marcarAlteracao);
  form.addEventListener('change',marcarAlteracao);
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!consultaAtual)return;
    const payload={consulta_id:consultaAtual.id,...readForm()};
    if(demoOn){
      consultaAtual._anotacao=payload;anotacaoAtual=payload;
      botaoSalvar.textContent='Salvo ✓';botaoSalvar.classList.add('sessao-salvo-ok');
      setMsg('Salvo apenas nesta demonstração · não vai para o banco');
      return;
    }
    botaoSalvar.disabled=true;botaoSalvar.textContent='Salvando…';
    botaoSalvar.classList.remove('sessao-salvo-ok');
    const {data,error}=await sb.from('anotacoes_consultas').upsert(payload,{onConflict:'consulta_id'}).select().single();
    botaoSalvar.disabled=false;
    if(error){
      botaoSalvar.textContent='Tentar salvar novamente';
      setMsg('Falha ao salvar');
      alert('Não foi possível salvar o registro: '+error.message);
      return;
    }
    anotacaoAtual=data;
    botaoSalvar.textContent='Salvo ✓';
    botaoSalvar.classList.add('sessao-salvo-ok');
    setMsg('Anotações salvas com sucesso em '+new Date(data.atualizado_em||data.criado_em).toLocaleString('pt-BR'));
    $s('sessao-status').textContent='Registro salvo';
    await loadHistory();
    document.querySelectorAll('details[data-k][open]').forEach(d=>loadPatientNotes(d));
  });
  $s('sessao-limpar').addEventListener('click',()=>{
    if(!confirm('Limpar os campos desta tela? O que já foi salvo no banco não será apagado.'))return;
    fillForm(null);marcarAlteracao();setMsg('Campos limpos · ainda não salvos');
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
    const {data,error}=await sb.from('anotacoes_consultas').select('consulta_id,conteudo,humor,temas,intervencoes,tarefas,plano,evolucao_nota').in('consulta_id',ids);
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
