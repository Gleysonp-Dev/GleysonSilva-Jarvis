# Roadmap — Projeto GleysonSilva-Jarvis

A ambição é criar uma experiência pessoal de voz, presença e execução que possa ser comparada com os melhores projetos existentes. Cada etapa abaixo exige comportamento verificável. Novidade, vantagem de latência ou superioridade geral só serão anunciadas com pesquisa atualizada e evidências reproduzíveis.

O código-fonte está publicado em [Gleysonp-Dev/GleysonSilva-Jarvis](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis). A versão 0.1.0 não representa um instalador assinado ou release de aplicativo aprovada para distribuição.

## Base atual — MVP 0.1.0

| Área | Implementado | O que ainda precisa de evidência real |
| --- | --- | --- |
| Interface | HUD ciano com título estável, pulsação por envelopes e estados do executor; conversa e painéis. | Fluidez e legibilidade em diferentes telas e com voz/câmera juntas. |
| OpenAI | Texto progressivo, memória recuperada, WebRTC, ferramentas e cancelamento. | Acesso da conta, áudio ouvido, qualidade em português, falhas de rede e custo real. |
| Execução | Pasta limitada, proposta de organização, filtro por mês, aprovação, registro e restauração condicionada. | Ensaios no Windows com arquivos descartáveis e interrupção em diferentes pontos. |
| Programas | Adaptadores pequenos para aplicativos cadastrados, editor e navegador dedicado. | Abertura/foco verificados nos programas e versões efetivamente usados. |
| Presença | Prévia de câmera independente; worker opcional; cadastro e consistência temporal. | Modelos instalados, pessoas voluntárias, luz variável, desconhecidos e ambiguidades. |
| Verificação | Testes offline de contratos e compilação. | Instalação limpa, armazenamento protegido e pacote Windows executável. |

As contagens e o estado final da suíte devem vir do registro de execução, não deste planejamento. Consulte [test-plan.md](test-plan.md) para separar testes substituídos de testes com serviços e hardware.

## Etapa 1 — Tornar a base utilizável no equipamento do autor

**Resultado:** abrir, configurar e usar o produto local sem depender de uma prévia visual.

- Executar instalação limpa com Node 24, dependências e `npm run verify`.
- Iniciar Electron; quando a abertura de janelas estiver bloqueada, usar `npm run test:local` e registrar o limite de integração nativa.
- Testar microfone local, prévia de câmera e liberação dos dispositivos sem chave.
- Configurar OpenAI no campo privado e comprovar texto, voz audível, transcrição e interrupção.
- Usar pasta descartável para prévia, correção do filtro, recusa, execução parcial, cancelamento e restauração.
- Registrar o efeito observado em cada aplicativo suportado.

**Aceite:** relatório por superfície, sem chamar um teste de parser de teste de webcam ou uma conexão aberta de resposta ouvida. Erros e requisitos ausentes devem permanecer visíveis.

## Etapa 2 — Publicar o código e viabilizar reprodução

**Resultado:** outra pessoa consegue instalar e ensaiar o MVP seguindo o README.

- Manter o repositório público com documentação, licença, avisos de terceiros e histórico revisável.
- Publicar o roteiro de instalação assistida e instruções de configuração privada.
- Fixar dependências reproduzíveis, executar CI e registrar a matriz suportada.
- Revisar o conteúdo público para excluir chaves, banco, rostos, gravações, pesos, caches e arquivos pessoais.
- Registrar capturas reais da interface com dados sintéticos e sem segredos.
- Validar pacote Windows em máquina limpa antes de oferecer um binário. Definir assinatura e atualização antes de apresentá-lo como distribuição pronta.

**Aceite:** URL real publicada, CI reproduzível e instruções que correspondam aos comandos presentes no checkout. Uma release de código-fonte não deve sugerir que existe um aplicativo assinado.

## Etapa 3 — Medir a conversa e aperfeiçoar a voz

**Resultado:** qualidade e velocidade avaliadas com o mesmo protocolo entre versões.

- Medir primeiro texto, primeiro áudio efetivamente reproduzido e fim audível após interrupção.
- Separar inicialização fria, sessão aquecida, espera humana e tempo da ferramenta.
- Registrar p50/p95, falhas, dispositivo, rede, modelo, duração, tokens e consumo observado.
- Avaliar sotaques, nomes, pausas, sobreposição, ruído e retomada depois de erro.
- Preparar o adaptador ElevenLabs com configuração privada e seleção explícita. A amostra e a autorização não equivalem a voz já criada no serviço.
- Concluir cadastro remoto autorizado e ensaiar a voz personalizada somente quando a conta e o fluxo do provedor estiverem prontos. Não prometer exportação de pesos.

**Aceite:** amostra documentada, áudio ouvido por uma pessoa e comparação que inclua erros e tentativas lentas. Metas numéricas passam a ser publicáveis depois da medição de referência.

## Etapa 4 — Procedimentos que podem ser corrigidos e revisados

**Hipótese de diferenciação:** uma correção falada durante a execução deve se converter em uma mudança de plano compreensível, preservando o registro dos efeitos concluídos e oferecendo restauração quando possível.

- Criar editor de procedimentos com gatilho, escopo, etapas, condições, permissões e versão.
- Exibir a diferença entre plano anterior e plano corrigido antes de continuar.
- Permitir salvar uma correção como nova versão, sem promovê-la silenciosamente a comportamento permanente.
- Acrescentar pontos de retomada que confirmem o estado real antes de agir.
- Distinguir passo compensável, efeito irreversível e ação cuja confirmação externa é insuficiente.
- Testar instruções ambíguas e mudanças de perfil durante execução.

**Aceite:** cenário reproduzível “organize os arquivos” → “somente os deste mês” com efeitos rastreáveis, nova proposta correta e restauração segura dos movimentos elegíveis. A exclusividade dessa combinação continua sujeita a pesquisa comparativa.

## Etapa 5 — Presença pessoal com limites claros

**Resultado:** reconhecimento útil para personalização sem criar autoridade invisível.

- Calibrar limiar, margem e consistência temporal com participantes voluntários.
- Ensaiar luz, ângulos, óculos, desconhecidos e mais de uma pessoa.
- Melhorar cadastro, revisão e exclusão com informação clara sobre dados retidos.
- Documentar falsos reconhecimentos e comportamento diante de fotos/vídeos.
- Manter confirmação explícita de perfil e autorização separada para ferramentas.

**Aceite:** comportamento neutro nos casos ambíguos, exclusão verificada e ausência de envio facial aos provedores de conversa. Webcam RGB continua fora do papel de autenticação.

## Etapa 6 — Ampliar integrações pela utilidade

Escolher novas integrações a partir de tarefas frequentes do autor: arquivos, editor, navegador e informações pessoais autorizadas. Cada adaptador deverá declarar contrato, acesso mínimo, aprovação de efeito, evidência de resultado, cancelamento e possibilidade de compensação.

Calendário, e-mail, mensagens, aplicativos complexos e dispositivos conectados exigem conectores próprios e autorização específica. O número de integrações não deve esconder resultados não verificados. Não ampliar para terminal irrestrito apenas para aparentar mais capacidades.

**Aceite:** tarefas reais concluídas com menos intervenção e regressões conhecidas documentadas. Comparações com projetos públicos devem usar versões e cenários identificados.

## Decisões preservadas

- Núcleo circular holográfico, ciano constante e pulsação variável; o nome central não vibra.
- OpenAI para inteligência e voz inicial; provedores substituíveis por contratos claros.
- Presença facial local, opcional e sem autorização automática.
- Memória explícita, revisável e separada por perfil; não anunciar retreinamento dos modelos.
- Execução com proposta, confirmação quando necessária e evidência do resultado.
- Publicação pública sem dados privados ou credenciais.

## Como priorizar a próxima mudança

Antes de ampliar escopo, descreva a tarefa concreta que melhora, o comportamento esperado, o risco de regressão e a forma de verificar o resultado. Um vídeo visualmente convincente é uma demonstração; um produto funcional precisa também de instalação reproduzível, ferramentas confiáveis e limites compreensíveis.
