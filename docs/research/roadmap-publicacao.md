# Roadmap de implementação e publicação

O escopo proposto combina uma demonstração forte com arquitetura extensível. A publicação pública ocorre depois da aprovação do escopo e da revisão da primeira versão executável.

# Etapas e critérios de saída

| Etapa | Entrega | Critério de saída | Estimativa de planejamento |
| --- | --- | --- | --- |
| Produto | Aprovar casos de uso, linguagem visual e hipótese de diferenciação | Fluxo demonstrador e itens fora do lançamento definidos | 1 a 2 dias |
| Prova de voz | OpenAI, áudio, interrupção e instrumentos de medição | Conversa em português, reconexão e cancelamento mensurados | 3 a 5 dias |
| Núcleo de ações | Broker de política, contratos, eventos e workspace de teste | Ferramentas não contornam permissões; falhas visíveis | 4 a 7 dias |
| Fluxo original | Organização de arquivos e correção durante execução | Pausa, revisão, verificação e compensação testadas | 5 a 8 dias |
| Presença | Cadastro opcional, câmera local e exclusão | Perfil estável e modo desconhecido; sem vazamento biométrico | 3 a 5 dias |
| Integrações | Navegador, aplicativos, ditado e VS Code | Matriz de operações suportadas reproduzível | 4 a 7 dias |
| Liberação | Instalador, documentação e benchmark público | Instalação limpa e demonstração sem cortes | 4 a 6 dias |

Estimativa preliminar de 24 a 40 dias de trabalho para uma pessoa experiente, sujeita aos resultados da prova de voz e automação. Não é um prazo contratado. Testes com participantes e refinamento de produto podem ampliar o calendário. Reavaliar o plano após cada etapa; não acumular integrações antes de provar o fluxo principal.

# Preparação do repositório

Estrutura proposta, a materializar após a aprovação:

```text
apps/desktop/          interface, áudio e estados
packages/contracts/   esquemas e eventos
packages/runtime/     política, tarefas e verificação
packages/connectors/  apps, arquivos, navegador e notas
services/vision/      presença e reconhecimento local
evals/                comandos em português e casos adversos
docs/                 arquitetura, privacidade e suporte
demo/                 arquivos sintéticos e roteiro
```

README em português e inglês com instalação, vídeo, limitações e matriz de suporte. Adicionar licença, avisos de terceiros, SECURITY, CONTRIBUTING, código de conduta, política de privacidade, modelo de configuração sem segredos e instruções para reportar falhas.

Configurar integração contínua para validação de contratos, testes de política, cancelamento e verificação, além de lint e build. Testes desktop devem rodar em ambiente apropriado e não ser apresentados como cobertos por uma execução sem interface gráfica. Separar teste simulado de teste contra API real, que depende de credenciais e gera custo.

# Verificações antes de publicar

1. Fixar versões e inventariar código, pesos e vozes. Conferir permissões de redistribuição e avisos.
2. Excluir chaves, cadastros faciais, gravações, preferências privadas e capturas do Git, incluindo histórico e artefatos do instalador.
3. Publicar resultados com hardware, versões, condições e custo medido. Não usar os objetivos como se fossem resultados.
4. Executar instalação limpa e desinstalação. Conferir remoção de câmera e processos auxiliares ao sair.
5. Demonstrar tanto sucesso quanto interrupção, falha e limite de suporte, com dados sintéticos.
6. Revisar o pacote, o nome do repositório e o destino. Criar o repositório público e release apenas dentro do escopo aprovado.

# Validação da originalidade

Comparar diretamente Dodaios, Leon, OpenDex, OpenAdapt, Understudy e UFO no mesmo roteiro. Registrar quais realizam correção verbal no meio de uma tarefa, delimitam efeitos já executados, propõem compensação válida e transformam a correção em procedimento versionado. Uma funcionalidade não encontrada na documentação fica como “não estabelecida”, não como “inexistente”.

Entrevistar cinco usuários que organizam arquivos ou repetem tarefas entre aplicativos. Comparar execução manual, comando único e correção durante execução. Medir conclusão, erros, tempo, esforço e confiança. Se a nova interação não melhorar os resultados, ajustar a proposta antes de ampliar o produto.

# Critério de liderança do produto

A ambição é superar os assistentes comparáveis na experiência escolhida. Toda afirmação pública de superioridade deve identificar os projetos e versões comparados, o conjunto de tarefas, o hardware e as condições de teste. Não converter objetivos internos em resultados demonstrados.

| Dimensão | Como sustentar uma vantagem |
| --- | --- |
| Voz | Comparar tempo até primeiro áudio útil, p95, interrupções corretas e retomada após ruído |
| Execução | Medir sucesso do fluxo inteiro, efeitos duplicados, recuperação e sucesso falso |
| Memória | Testar recordação correta, isolamento de perfis, correção e exclusão |
| Documentos | Verificar resposta e referência de origem; testar documentos conflitantes e sem resposta |
| Interface | Avaliar entendimento do estado, clareza da interrupção e facilidade de corrigir uma tarefa |
| Instalação e custo | Comparar instalação limpa, requisitos e custo por tarefa concluída |

Selecionar os concorrentes mais fortes disponíveis na data de cada avaliação, incluindo o Projeto Jarvis de nicolasmafre. Registrar também os cenários em que outro projeto obtiver resultado melhor. O escopo do lançamento se amplia quando o núcleo comprovar qualidade, preservando uma trajetória de melhoria mensurável.

# Custos

OpenAI exige acesso à API e consumo conforme uso. O protótipo visual não consome API. Estimar custo operacional a partir de minutos de entrada e saída, tokens de tarefas, chamadas de ferramentas, repetição e quantidade de usuários. Consultar a tabela vigente quando escolher os modelos; não estimar mensalidade a partir de um diálogo isolado.

No modo OpenAI, GPU dedicada não será requisito inicial. Processamento totalmente local é uma futura configuração com desempenho e requisitos publicados separadamente.

# Próximas versões

Após o MVP: aprendizagem guiada de mais procedimentos, palavra de ativação com modelo licenciável, integrações GitHub e calendário, Home Assistant, memória com busca semântica quando necessária e suporte a outros sistemas operacionais. Cada extensão precisa de caso de uso, limites de permissão e teste de resultado próprios.
