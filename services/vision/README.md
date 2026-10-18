# Visão local opcional

`worker.py` recebe quadros JPEG/PNG por um pipe privado, detecta rostos com YuNet, alinha os cinco pontos faciais e extrai vetores SFace normalizados de 128 números. Não abre câmera, não acessa rede, não identifica nomes, não cadastra pessoas e não grava imagens ou vetores. O aplicativo continua funcionando quando Python, modelos ou dependências estão ausentes.

O processo principal solicita o quadro da câmera somente após ativação explícita, limita a frequência e mantém no máximo um quadro em análise. Os vetores ficam no processo principal, protegidos pelo armazenamento cifrado do sistema; nunca retornam ao renderer ou à OpenAI. O score retornado é confiança de **detecção de rosto**, não confiança de identidade. Comparar vetores exige limiar calibrado, margem entre candidatos, consistência temporal e recusa diante de múltiplos rostos. A câmera RGB não oferece prova de vida e não autoriza ações ou dados privados.

## Preparação manual

Use Python 3.10 ou superior em ambiente virtual próprio. Instale opcionalmente as versões de `requirements.txt`; a instalação do desktop não faz isso automaticamente. Para Windows, configurar `JARVIS_PYTHON` com o caminho absoluto do executável desse ambiente permite ao processo principal escolher o interpretador sem depender de associações do sistema.

Os dois modelos devem ficar em `<pasta de dados do aplicativo>/models`, fora do repositório:

| Arquivo esperado | Fonte oficial | Licença do diretório |
| --- | --- | --- |
| `face_detection_yunet_2023mar.onnx` | [YuNet no OpenCV Zoo](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) | [MIT](https://github.com/opencv/opencv_zoo/blob/main/models/face_detection_yunet/LICENSE) |
| `face_recognition_sface_2021dec.onnx` | [SFace no OpenCV Zoo](https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface) | [Apache 2.0](https://github.com/opencv/opencv_zoo/blob/main/models/face_recognition_sface/LICENSE) |

Baixe manualmente os arquivos binários reais do OpenCV Zoo, e não os pequenos ponteiros Git LFS. Guarde as licenças e registre versão, origem e SHA-256 antes de distribuir modelos. Este repositório não redistribui pesos nem efetua downloads automáticos. O nome YuNet de março de 2023 é intencional: os modelos mais recentes `2026may` usam requisitos diferentes do backend OpenCV 4.12 selecionado aqui. A documentação oficial descreve [detecção, alinhamento e extração SFace](https://docs.opencv.org/4.12.0/d0/dd4/tutorial_dnn_face.html).

## Protocolo

Inicie `python -I worker.py --models-dir <diretório absoluto>` com pipes privados, sem shell e sem janela. `--status` imprime uma linha JSON de disponibilidade e encerra. No modo persistente, cada linha de entrada produz exatamente uma linha de saída; não há evento de inicialização espontâneo.

Entrada de análise: `{"id":"frame_1","imageBase64":"<base64 puro de JPEG/PNG>"}`. Um campo `"type":"analyze"` é opcional. Data URLs, URLs de rede e caminhos de arquivos não são aceitos. O processo principal remove o prefixo da data URL e não registra o payload.

Saída: `{"ok":true,"id":"frame_1","faces":[{"bbox":[x,y,w,h],"score":0.98,"embedding":[...]}],"width":640,"height":480,"multipleFaces":false,"truncated":false}`. As coordenadas referem-se ao quadro recebido. Não interpretar `score` como probabilidade de identidade.

Entrada de estado: `{"type":"status","id":"status_1"}`. Saída disponível: `{"ok":true,"available":true,"backend":"opencv-yunet-sface-cpu","embeddingDimensions":128}`; quando ausente, `available:false` e `reason:{code,message}`. Erros de quadro usam `ok:false,error:{code,message}` sem ecoar imagem, caminhos ou exceções nativas.

Limites: 2 MB comprimidos, lado até 2560 px, até 4.194.304 pixels e até seis vetores por quadro. Mais de um rosto seta `multipleFaces:true`; o processo principal deve manter saudação neutra. O worker inspeciona dimensões antes da decodificação, usa CPU com um thread e rejeita formatos adicionais. Para encerrar, feche stdin e termine o processo caso o prazo expire; descarte respostas de gerações antigas.

## Validação

`python -I -B -m unittest discover -s services/vision -p "test_*.py"` cobre o protocolo, rejeição de imagens, limites, alinhamento antes de extração e normalização com um backend de teste. Os testes não instalam OpenCV nem representam uma medição com webcam. A validação com câmera, pessoas voluntariamente cadastradas, luz variável, óculos, desconhecidos e fotos ainda precisa ser realizada no equipamento final.
