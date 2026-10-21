# Referência visual do núcleo — revisão 0.3.1

Em 20 de outubro de 2026, o autor forneceu um vídeo de demonstração do Jarvis de Lucas Victor para corrigir a aparência do núcleo. O arquivo tem aproximadamente 49,92 segundos e resolução de 720 × 1280. Esta nota registra inspeção visual de quadros selecionados; não representa transcrição integral do áudio, auditoria do código comercial ou execução do produto de referência.

## Núcleo observado

O núcleo aparece nos primeiros segundos. O quadro de aproximadamente cinco segundos mostra o estado de espera com maior detalhe. O quadro seguinte já apresenta uma panorâmica da lateral, sem núcleo, e não serve para medir sua animação.

- Contorno aproximadamente circular, formado por curvas assimétricas que se cruzam em uma faixa de espessura variável.
- Vários fios discretos e poucas trajetórias dominantes; a sobreposição impede contar todos os laços completos com segurança.
- Azul-ciano nos fios, iluminação azul profunda ao fundo e dois ou três focos localizados nas trajetórias.
- Centro sem texto ou objeto sólido, com a grade de fundo visível através dele.
- O núcleo continua azul em um quadro de processamento; a mudança de cor observada está no rótulo de estado, não no conjunto inteiro.

A filmagem contém perspectiva, reflexos e mudanças de enquadramento. Não permite afirmar igualdade de pixels ou determinar com precisão o algoritmo e a velocidade usados no produto de referência.

## Implementação própria

A 0.3.1 ajusta o renderizador Canvas a essas características: curvas com intensidades desiguais, deformação assimétrica, camadas de emissão azul, focos nas trajetórias e campo azul com grade discreta. A paleta permanece fixa em todos os estados. O pulso continua ligado aos níveis reais do microfone e do áudio reproduzido; execução e preparação mantêm suas cadências.

O vídeo é referência de aparência. Seus quadros, marcas, legendas, código comercial e configurações de conexão não são distribuídos no repositório ou no pacote. O renderizador é código próprio. A voz, o preset metálico, a velocidade e a música privada aprovados não são alterados por esta revisão.

## Outras funções mostradas

O restante do vídeo apresenta um catálogo de fontes e a configuração de uma conexão remota eWeLink por MCP, com duas ferramentas anunciadas. A interface oferece verificação e desconexão, além de exemplos de comandos para dispositivos domésticos. Home Assistant aparece como opção disponível para adicionar, sem evidência de conexão ativa nos quadros examinados. Outros cartões de serviços indicam disponibilidade ou estado informado pelo produto; sua listagem não comprova funcionamento de cada integração.

Uma legenda anuncia a ativação de uma luz. Os quadros, isoladamente, não mostram uma sequência completa de chamada de ferramenta e leitura independente do estado do dispositivo. A menção a MQTT não identifica por si só uma conexão direta do aplicativo a um broker.

Essas conexões **não foram adicionadas à 0.3.1**. Para uma integração própria, são necessários o sistema/dispositivo do usuário, autenticação privada, descoberta das ferramentas, escopo permitido, confirmação quando aplicável, cancelamento e verificação do resultado. Endereços ou credenciais visíveis no vídeo não devem ser utilizados. Nenhum cartão de integração deve ser apresentado como conectado sem uma conexão real validada.

Resultados do renderizador e do pacote ficam registrados em [Validação](../validation.md); requisitos de evolução, em [Roadmap](../roadmap.md).
