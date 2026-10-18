# Especificação do MVP de assistente pessoal

Proposta revisada em 18 de outubro de 2026 para incluir interface cinematográfica, OpenAI e reconhecimento facial opcional.

O produto ajuda uma pessoa a executar tarefas no Windows usando português natural. O benefício principal é poder acompanhar e corrigir a execução com clareza. O primeiro lançamento precisa provar esse comportamento em poucos fluxos úteis.

# Experiência que demonstra a proposta

A pessoa diz “organize os documentos da minha pasta de trabalho por projeto”. O assistente exibe a prévia. Durante a execução, a pessoa corrige “só os deste mês”. A linha do tempo marca os efeitos já concluídos, remove os passos futuros incompatíveis e apresenta a compensação dos movimentos que podem ser revertidos. Ao final, oferece salvar a regra como uma versão de procedimento, com exemplos que devem e não devem ser incluídos.

O teste inicial usa uma pasta de demonstração, sem exclusão permanente e sem sobrescrita. A reversão só é oferecida quando o estado atual permite restaurar o arquivo sem perda. Envio de mensagens, pagamentos e publicações não têm desfazer universal.

# Escopo de lançamento

| Capacidade | Entrega |
| --- | --- |
| Interface | HUD circular baseado na referência do usuário, modo Foco, conversa, execução, memória e configurações |
| Voz | Atalho para falar, resposta transmitida progressivamente, interrupção e entrada de texto |
| OpenAI | Realtime para voz; Responses para solicitações de texto e tarefas que exigem planejamento |
| Memória | Preferências explícitas, editáveis e apagáveis, separadas por perfil |
| Procedimentos | Um fluxo de organização de arquivos com parâmetros, versões e verificação |
| Desktop | Abrir/focar aplicativos cadastrados e abrir projeto no VS Code |
| Navegador | Perfil dedicado, abrir URL e resumir conteúdo selecionado |
| Ditado | Bloco de Notas em versão de Windows suportada |
| Câmera | Presença e reconhecimento de pessoas cadastradas, local e opcional |
| Diagnóstico | Tempos por etapa, erros, consumo do provedor e estado da conexão |

Palavra de ativação, controle visual arbitrário, treinamento universal por demonstração, integrações de comunicação, casa conectada e suporte a outros sistemas entram depois. Cada uma amplia a superfície de falhas e exige critérios próprios.

# Arquitetura proposta

Electron e React com TypeScript para interface, áudio WebRTC e animação. Processo principal para credenciais, política de execução e conectores. Serviço Python local opcional para OpenCV e adaptadores Windows. SQLite para preferências, procedimentos e eventos. Adaptadores do provedor mantêm os modelos configuráveis.

Fluxo principal: entrada de voz ou texto → compreensão → proposta de ferramenta → validação de esquema e política → aprovação quando necessária → execução → verificação → evento visível → resposta. O modelo propõe; o executor decide conforme as permissões concedidas.

O núcleo de áudio e a interface não esperam por uma tarefa longa. Uma fila serializa efeitos conflitantes. Cada ação tem identificador, deadline, estado, estratégia de verificação e regra de repetição. Cancelar a conversa não pode deixar a execução sem supervisão.

## Estados observáveis

Pronto, ouvindo, interpretando, aguardando autorização, executando, verificando, concluído, pausado e falhou. A interface deve diferenciar desconexão de silêncio e simulação de conexão real. Só eventos reais do áudio animam o medidor em produção.

O cancelamento incrementa a geração da tarefa; resultados antigos não podem iniciar novas ações. Operações já confirmadas pelo destino continuam registradas. Se uma ação não puder ser interrompida, aguardar sua resposta e verificar antes de continuar.

# Integração OpenAI

A [documentação oficial de WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc) descreve inicialização mediada pelo servidor e credenciais efêmeras. A chave permanente ficará fora do renderer, no armazenamento de credenciais do sistema; o cliente de voz usará uma sessão curta. Não pedir chave em conversa nem gravá-la em logs.

A [Realtime API](https://developers.openai.com/api/docs/guides/realtime-conversations) permite conversa de áudio e chamadas de ferramentas. As ferramentas locais terão esquemas fechados e serão executadas apenas pelo broker de política. O caminho de texto seguirá o contrato de [function calling](https://developers.openai.com/api/docs/guides/function-calling), com validação adicional de caminhos, URLs e permissões.

Não fixar um modelo por ser o mais novo. Escolher IDs disponíveis na conta e compará-los em português por latência, execução correta e custo. Registrar os modelos e versões usados no benchmark. Exibir estimativa de consumo; o teto de gasto do aplicativo deve rejeitar novas sessões quando atingido e contabilizar sessões concorrentes.

Memória de preferências e recuperação de procedimentos não retreinam pesos do modelo. Fine tuning só entra se avaliações mostrarem um problema repetido que exemplos, contexto e ferramentas não resolvem.

No modo OpenAI, áudio e conteúdo necessário à resposta saem do dispositivo. O reconhecimento facial permanece local. [Controles de dados da API](https://developers.openai.com/api/docs/guides/your-data) distinguem retenção de aplicação e de monitoramento; `store: false` não deve ser anunciado como garantia de retenção zero.

# Reconhecimento facial opcional

Usar inicialmente OpenCV com YuNet para localizar rostos e SFace para comparar uma representação numérica com os cadastros locais. O [tutorial oficial](https://docs.opencv.org/4.12.0/d0/dd4/tutorial_dnn_face.html) demonstra captura, alinhamento e comparação. O score de similaridade não é probabilidade de identidade; calibrar limiar e margem para o segundo candidato no hardware e nas condições de uso.

## Comportamento

1. Câmera desligada por padrão; tela explica presença e identificação separadamente.
2. Cadastro voluntário com nome escolhido e imagens de múltiplos ângulos; processar quadros em memória.
3. Armazenar apenas representações necessárias, cifradas com chave protegida pelo sistema, sem incluir na pasta do repositório. Representações continuam sendo dados biométricos, não dados anônimos.
4. Exigir consistência por vários quadros e prazo de validade curto. Baixa confiança produz “pessoa não identificada”, sem adivinhar nome.
5. Com múltiplas pessoas, usar saudação neutra e suspender leitura espontânea de dados privados. Perfil reconhecido não prova quem está falando.
6. Respeitar intervalo entre saudações; fechar a captura ao desligar, bloquear a sessão ou encerrar o aplicativo.
7. Permitir apagar cada cadastro e toda a base; testes confirmam também a exclusão de cópias e dados auxiliares gerados pelo aplicativo.

Reconhecimento de webcam RGB serve para personalização. Não equivale a prova de vida ou autenticação resistente a fotos e vídeos. Não liberar dados privados ou ações sensíveis apenas pelo rosto; confirmação de risco deve usar interação explícita ou autenticação apropriada do sistema.

A [ANPD trata biometria como tema de dados pessoais sensíveis](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-abre-tomada-de-subsidios-sobre-tratamento-de-dados-biometricos). O lançamento deve explicar finalidade, retenção e controle do cadastro. A aplicação concreta das obrigações depende da forma de uso e distribuição; consentimento não substitui as demais medidas de proteção.

## Metas de câmera

Começar com captura reduzida e análise de 2 a 5 quadros por segundo em worker separado. Medir presença até perfil estável, CPU, memória, temperatura e impacto na latência da voz. O reconhecimento não pode bloquear a reprodução do áudio. Medir identificação falsa, rejeição falsa, desconhecidos, duas pessoas, mudanças de luz, óculos, foto, vídeo e câmera ocupada. Não prometer taxa de acerto sem esse ensaio.

# Padrões úteis incorporados à arquitetura

A análise do [Projeto Jarvis de nicolasmafre](https://github.com/nicolasmafre/Projeto_Jarvis) acrescenta seis padrões à especificação. A implementação será própria; o aproveitamento desta etapa é arquitetural.

| Padrão útil | Aplicação no nosso projeto | Evolução necessária |
| --- | --- | --- |
| Memória persistente | Preferências e fatos recuperáveis entre sessões | Origem, aprovação, validade, edição e exclusão por perfil |
| Consulta a documentos locais | Adaptador separado para conhecimento do usuário | Indexação por trechos, referências ao arquivo, atualização incremental e tratamento de conteúdo não confiável |
| Estado de tarefa salvo | Preservar plano, etapa e histórico | Registrar efeitos reais, impedimento de duplicatas e revalidação antes de retomar |
| Provedores substituíveis | Contratos separados para conversa, embeddings, STT e TTS | OpenAI primeiro; transmissão progressiva e cancelamento desde o contrato |
| Motor separado da interface | Mesmo núcleo alimenta HUD e modo Foco | Eventos reais e assíncronos, sem bloquear o áudio enquanto uma tarefa roda |
| Configuração explícita | Assistente inicial de dispositivos e conexões | Testes de entrada e saída, dependências opcionais e versões reproduzíveis |

Consulta ampla a documentos entra após o fluxo principal, preservando desde o início o contrato do adaptador. O primeiro fluxo não precisa carregar Torch ou um classificador de sentimentos. Nenhum desses padrões, isoladamente, será anunciado como invenção do produto.

# Interface

O HUD circular enviado pelo usuário é a referência visual principal: nome J.A.R.V.I.S. no centro escuro, faixa azul larga segmentada, arcos ciano de diferentes espessuras, retículas radiais densas e poucos acentos âmbar. As camadas se movem independentemente. Foco transforma o mesmo sistema em área de trabalho, com conversa e ações legíveis. A animação terá modo reduzido e nunca esconderá autorização, erro ou cancelamento.

O núcleo representa estados reais em produção. O painel de presença mostra apenas as informações autorizadas. A memória mostra origem e data de cada preferência; a pessoa pode corrigir uma sem apagar o perfil inteiro.

O núcleo mantém o ciano original em todos os estados. A atividade muda somente a pulsação: suave ao ouvir, mais marcada ao responder e cadenciada durante uma ação. A pulsação altera o brilho e a expansão dos anéis, mantendo o nome central estável. Na versão funcional, escuta e resposta acompanham o envelope do áudio capturado e efetivamente reproduzido; a pulsação de execução depende de uma ferramenta em atividade. Aguardar o modelo não equivale a executar uma ação. Interrupção e término atualizam imediatamente o estado. Com movimento reduzido ou animação desativada, preservar cor e rótulo e interromper a pulsação.

O protótipo desta fase simula conversa, presença e tarefas, sem abrir câmera, microfone, aplicativos ou conexão OpenAI. Serve para aprovar interação e linguagem visual.

# Contrato dos conectores

Cada ferramenta declara nome, versão, esquema de entrada, alvos permitidos, efeitos, requisito de aprovação, timeout, cancelamento e verificação. A resposta distingue sucesso confirmado, resultado desconhecido, falha e cancelamento. Uma função de compensação é opcional e só será mostrada quando válida.

Primeiros contratos: `apps.open`, `apps.focus`, `workspace.list`, `workspace.preview_organize`, `workspace.apply_organize`, `workspace.compensate`, `browser.open`, `browser.read_selected`, `notes.dictate`, `memory.propose`, `memory.confirm` e `procedure.revise`. Não expor execução arbitrária de código ao modelo.

# Critérios de aceite

- Instalação limpa em uma versão documentada do Windows, sem exigir GPU ou WSL no modo OpenAI.
- Todos os conectores passam por política e verificação; conteúdo de página não amplia permissões.
- Concluir o fluxo demonstrador, interrompê-lo e corrigir o filtro sem efeitos duplicados.
- “Concluído” depende de evidência; falhas injetadas nunca geram sucesso falso no conjunto de testes.
- Atender às metas de áudio e tarefas simples descritas na auditoria, ou publicar honestamente os resultados e revisar o escopo antes de anunciar desempenho.
- Câmera recusada, desconectada ou sem rosto não impede conversa; nenhum cadastro biométrico entra em logs ou Git.
- Credenciais não aparecem em renderer, logs, exportações ou pacotes de demonstração.
- Interface utilizável por teclado, com foco visível, texto legível e movimento reduzido.

# Decisões para aprovação

Recomendação: Windows e português brasileiro; OpenAI como modo principal; câmera local opcional; HUD circular com Foco; demonstração de correção de arquivos; código próprio Apache 2.0. Após aprovar, escolher nome público, conta de destino e orçamento operacional. Não é necessário fornecer chave de API no chat.
