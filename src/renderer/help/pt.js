'use strict';
// Ajuda, português. O formato está em help.js; os identificadores das seções são os mesmos de en.js.
HELP_TEXT.pt = {
  ui: {
    title: 'Ajuda',
    search: 'Pesquisar na ajuda',
    close: 'Fechar',
    none: 'Nada encontrado.',
    found: '{n} ocorrências em {s} seções',
    hint: 'F1 abre esta ajuda a qualquer momento.',
    keysIntro: 'Todos os comandos do programa com as teclas que têm agora. No Mac, Ctrl é Cmd e Alt é Option. Você pode mudar qualquer tecla em Configuração > Atalhos de teclado...; esta lista acompanha suas alterações.',
    keysFoot: 'Também: Enter abre a pasta, o arquivo compactado ou o arquivo sob o cursor, Backspace sobe um nível, Tab troca de painel, as setas, Home, End, PageUp e PageDown movem o cursor, Esc fecha caixas de diálogo e menus. Texto digitado vai para a linha de comando na parte de baixo.',
  },
  sections: [
    {
      id: 'start', t: 'Primeiros passos',
      h: `<p>O Alternate Commander é um gerenciador de arquivos com <b>dois painéis</b>, no estilo do Total Commander. Um painel está ativo (o caminho dele fica destacado); o outro é o destino das cópias e movimentações. Tudo pode ser feito pelo teclado, e tudo também tem um item de menu ou um botão.</p>
<ul>
<li><kbd>Tab</kbd> troca o painel ativo. As setas movem o cursor, <kbd>Enter</kbd> abre uma pasta, um arquivo compactado ou um arquivo, <kbd>Backspace</kbd> sobe um nível.</li>
<li><kbd>F5</kbd> copia os arquivos selecionados para o outro painel, <kbd>F6</kbd> os move, <kbd>F7</kbd> cria uma pasta, <kbd>F8</kbd> exclui, <kbd>F3</kbd> visualiza, <kbd>F4</kbd> edita. Esses botões também estão na parte inferior da janela.</li>
<li>O botão no canto superior esquerdo de um painel abre a <b>lista de unidades</b> (<kbd>Alt+F1</kbd> para o painel esquerdo, <kbd>Alt+F2</kbd> para o direito): discos, pastas padrão, unidades de rede, favoritos e suas conexões com servidores e nuvens.</li>
<li>O <b>menu</b> abre com o mouse ou com <kbd>F9</kbd> / <kbd>F10</kbd>. O último item, <b>Sobre</b>, contém esta ajuda e a janela de versão e atualizações.</li>
</ul>
<p class="help-tip">Está começando? Leia primeiro “Painéis, abas e navegação”, “Selecionar arquivos” e “Copiar, mover, renomear, excluir”. Os demais capítulos descrevem os recursos extras um a um; use o campo de pesquisa para encontrar uma palavra.</p>
<p>Abaixo dos painéis fica a <b>linha de comando</b>: digite um comando e pressione Enter para executá-lo na pasta do painel ativo; <code>cd pasta</code> muda, em vez disso, a pasta do painel ativo. <kbd>Ctrl+Enter</kbd> coloca na linha de comando o nome do arquivo sob o cursor, <kbd>Ctrl+Shift+Enter</kbd> o caminho completo.</p>`,
    },
    {
      id: 'panels', t: 'Painéis, abas e navegação',
      h: `<h3>Pastas e a lista de unidades</h3>
<p>O caminho de um painel aparece acima da lista; a linha abaixo da lista mostra o número e o tamanho dos arquivos selecionados e de todos. <kbd>Alt+F1</kbd> / <kbd>Alt+F2</kbd> abrem a lista de unidades do painel esquerdo / direito. Ela contém: os discos locais, as unidades de rede mapeadas (com o caminho de rede), as pastas padrão (Início, Área de Trabalho, Documentos, Downloads ...), no Windows as distribuições <b>WSL</b> instaladas e, abaixo, suas conexões abertas e salvas (NAS, SSH, FTP, WebDAV, Dropbox, Google Drive). No macOS, os volumes de <code>/Volumes</code> (inclusive compartilhamentos de rede) são listados.</p>
<h3>Histórico e voltar</h3>
<p><kbd>Alt+Left</kbd> e <kbd>Alt+Right</kbd> voltam e avançam no histórico do painel. <kbd>Ctrl+U</kbd> troca os dois painéis de lugar; o menu Comandos também tem “Destino=Origem”, que mostra a mesma pasta no outro painel.</p>
<h3>Abas</h3>
<p>Cada painel tem as próprias abas: <kbd>Ctrl+T</kbd> abre uma nova (cópia da pasta atual), <kbd>Ctrl+W</kbd> a fecha, <kbd>Ctrl+Tab</kbd> / <kbd>Ctrl+Shift+Tab</kbd> alternam entre elas e <kbd>Ctrl+Up</kbd> abre a pasta (ou o arquivo compactado) sob o cursor em uma nova aba. As abas são lembradas quando você fecha o programa.</p>
<h3>Ordenação e modos de exibição</h3>
<p>Clique no cabeçalho de uma coluna ou pressione <kbd>Ctrl+F3</kbd> (nome), <kbd>Ctrl+F4</kbd> (extensão), <kbd>Ctrl+F5</kbd> (data), <kbd>Ctrl+F6</kbd> (tamanho). A mesma tecla de novo inverte a ordem. <kbd>Ctrl+Shift+F4</kbd> muda o painel para <b>miniaturas</b> (imagens, quadros de vídeo, PDF e documentos); <kbd>Ctrl+Q</kbd> transforma o outro painel em uma <b>visualização rápida</b> do arquivo sob o cursor. <kbd>Ctrl+R</kbd> lê a pasta novamente.</p>
<h3>Diretórios favoritos</h3>
<p><kbd>Ctrl+D</kbd> abre suas pastas favoritas. A pasta atual pode ser adicionada à lista, inclusive a pasta atual de um disco na nuvem, NAS, SSH, FTP ou WebDAV: ao escolher um favorito assim, o programa reconecta, se preciso, e vai direto para lá. Os favoritos do Total Commander são importados uma vez de <code>wincmd.ini</code>, se o programa o encontrar.</p>`,
    },
    {
      id: 'select', t: 'Selecionar arquivos',
      h: `<p>A maioria dos comandos age nos arquivos <b>selecionados</b> ou, se nada estiver selecionado, no arquivo sob o cursor. Os nomes selecionados aparecem em outra cor.</p>
<ul>
<li><kbd>Insert</kbd> seleciona o arquivo e desce; <kbd>Space</kbd> seleciona e permanece (em uma pasta também calcula o tamanho total do conteúdo, mostrado na coluna Tamanho).</li>
<li><kbd>Num +</kbd> seleciona um grupo por máscara (<code>*.jpg</code>, <code>report*.*</code>), <kbd>Num -</kbd> desmarca um grupo, <kbd>Num *</kbd> inverte a seleção, <kbd>Ctrl+A</kbd> seleciona tudo, <kbd>Ctrl+Num -</kbd> desmarca tudo.</li>
<li><kbd>Alt+Num +</kbd> seleciona todos os arquivos com a mesma extensão do arquivo sob o cursor.</li>
<li>Com o mouse: <kbd>Ctrl</kbd>+clique adiciona ou remove um arquivo. Com o teclado: segure <kbd>Shift</kbd> enquanto move o cursor com as setas.</li>
</ul>
<p>O menu <b>Marcar</b> tem os mesmos comandos e também “Copiar nomes selecionados” e um comando igual com os caminhos completos (útil para colar uma lista de arquivos em uma mensagem). <b>Comparar diretórios</b> (<kbd>Shift+F2</kbd>) seleciona, nos dois painéis, os arquivos que faltam no outro painel ou que são mais novos ou diferentes (duas pastas normais, não arquivos compactados nem servidores).</p>`,
    },
    {
      id: 'ops', t: 'Copiar, mover, renomear, excluir',
      h: `<ul>
<li><b>Copiar / Mover</b> (<kbd>F5</kbd> / <kbd>F6</kbd>): a caixa mostra o destino (a pasta do outro painel); você pode mudá-lo ou dar um novo nome. Se um arquivo já existir, o programa pergunta se deve substituí-lo ou ignorar os existentes. As pastas são copiadas com tudo que há dentro.</li>
<li><b>Renomear</b>: <kbd>F2</kbd> ou <kbd>Shift+F6</kbd> pergunta o novo nome do arquivo sob o cursor. <b>Renomear em massa</b> (<kbd>Ctrl+M</kbd>) renomeia muitos arquivos por máscaras de nome e extensão (<code>[N]</code> nome, <code>[C]</code> contador, <code>[YMD]</code> data, trechos do nome antigo), com busca e substituição, pré-visualização e predefinições salvas.</li>
<li><b>Nova pasta</b>: <kbd>F7</kbd>. <b>Editar novo arquivo</b>: <kbd>Shift+F4</kbd>.</li>
<li><b>Excluir</b>: <kbd>F8</kbd> ou <kbd>Delete</kbd> envia os arquivos para a Lixeira; <kbd>Shift+F8</kbd> ou <kbd>Shift+Delete</kbd> exclui permanentemente. Em servidores e em arquivos compactados não há Lixeira: os arquivos são removidos na hora. No Dropbox os arquivos excluídos ficam 30 dias; no Google Drive vão para a Lixeira dele.</li>
<li><b>Propriedades</b> (<kbd>Alt+Enter</kbd>), <b>Calcular espaço ocupado...</b> (<kbd>Ctrl+L</kbd>) e <b>Alterar atributos...</b> estão no menu Arquivos.</li>
</ul>
<h3>Progresso, segundo plano e fila</h3>
<p>Tarefas longas mostram uma janela de progresso com o nome do arquivo, a velocidade e um botão <b>Cancelar</b>. <b>Pausa</b> interrompe a tarefa por um tempo. <b>Em segundo plano</b> envia a tarefa para a fila e devolve a janela a você; na caixa de cópia isso é o botão <b>F2 Fila</b> (a tarefa vai direto para a fila, sem janela de progresso); a janela da fila lista as tarefas em espera, que rodam uma após a outra, e você pode reordená-las ou cancelá-las. A cópia entre dois discos remotos (por exemplo, do Dropbox para um NAS) passa automaticamente por uma pasta temporária neste computador.</p>
<p class="help-tip">Para copiar um arquivo de um servidor ou de um arquivo compactado, abra a pasta de destino no outro painel e pressione <kbd>F5</kbd>. Para copiar para um servidor ou arquivo compactado, abra-o primeiro no outro painel.</p>`,
    },
    {
      id: 'archives', t: 'Arquivos compactados',
      h: `<p>Os arquivos compactados abrem como pastas: <kbd>Enter</kbd> em um deles mostra o conteúdo, <kbd>Backspace</kbd> no nível superior sai dele. <kbd>F3</kbd> visualiza um arquivo dentro, <kbd>F5</kbd> copia arquivos para fora.</p>
<table>
<tr><th>Formato</th><th>Navegar e copiar para fora</th><th>Alterar no local</th><th>Compactar</th></tr>
<tr><td>zip</td><td>sim</td><td>sim (adicionar, excluir, renomear, nova pasta, editar e salvar um arquivo)</td><td>sim</td></tr>
<tr><td>7z, tar, tar.gz (tgz), tar.bz2, tar.xz, cab, gz, bz2, xz</td><td>sim</td><td>não (somente leitura)</td><td>7z, tar, tar.gz, tar.bz2, tar.xz, gz, bz2, xz</td></tr>
<tr><td>rar</td><td>sim</td><td>não</td><td>não (somente extrair)</td></tr>
</table>
<ul>
<li><kbd>Alt+F5</kbd> <b>compacta</b> os arquivos selecionados (escolha o formato e o nome; progresso e cancelamento como na cópia). <kbd>Alt+F9</kbd> <b>descompacta</b> os arquivos compactados selecionados ou apenas os arquivos selecionados de um arquivo compactado aberto.</li>
<li><kbd>Alt+Shift+F9</kbd> <b>testa</b> arquivos compactados (verifica se não estão danificados). Menu Arquivos: <b>Dividir arquivo...</b> e <b>Combinar arquivos...</b> (com o arquivo <code>.crc</code> do Total Commander).</li>
<li>Um arquivo compactado em um servidor NAS ou SSH é baixado para uma cópia temporária e abre somente para leitura; é possível copiar arquivos dele. Copiar diretamente entre dois arquivos compactados ainda não é suportado: use uma pasta intermediária.</li>
</ul>`,
    },
    {
      id: 'search', t: 'Procurar arquivos',
      h: `<p><b>Comandos > Pesquisar...</b> (<kbd>Alt+F7</kbd>) abre a janela de pesquisa.</p>
<ul>
<li><b>Nomes:</b> várias máscaras separadas por <code>;</code> e exclusões depois de <code>|</code>, por exemplo <code>*.js;*.ts|node_modules/</code>, ou uma expressão regular. Pesquisa em uma ou várias pastas, só nos itens selecionados, com limite de profundidade, e nomes dentro de arquivos zip.</li>
<li><b>Texto dentro de arquivos:</b> palavras inteiras, maiúsculas e minúsculas, expressão regular, bytes hexadecimais, “não contém”; as codificações ANSI, DOS, UTF-8 e UTF-16 são testadas; o texto dentro de arquivos docx, xlsx, pptx e OpenDocument também é encontrado.</li>
<li><b>Filtros:</b> data (entre, mais novos ou mais antigos que), tamanho, atributos. <b>Duplicados:</b> arquivos com o mesmo nome, o mesmo tamanho ou o mesmo conteúdo.</li>
<li>Clique duas vezes em um resultado para ir ao arquivo; <b>Para o painel (lista)</b> mostra todos os resultados como uma lista em um painel, onde F3, F5, F8 e os outros comandos funcionam sobre eles.</li>
</ul>
<h3>Índice de arquivos (busca rápida)</h3>
<p>Configuração > <b>Índice de arquivos (busca rápida)...</b> cria um índice dos nomes de arquivos das pastas escolhidas (em segundo plano; é guardado compactado na pasta de dados do programa). Com “Usar o índice” marcado, as buscas por nome, tamanho e data são instantâneas quando todas as pastas pesquisadas estão dentro de pastas indexadas; caso contrário, roda a pesquisa normal no disco. A busca de texto dentro de arquivos sempre lê os arquivos.</p>`,
    },
    {
      id: 'viewer', t: 'Visualizador, editor e visualização rápida',
      h: `<h3>Visualizador (F3)</h3>
<p>Mostra o arquivo sob o cursor sem abrir outro programa: texto com detecção automática da codificação (UTF-8, UTF-16, Windows-1251, CP866 ...; a lista Codificação, no alto, a altera), despejo hexadecimal, imagens, PDF, vídeo e áudio. <b>Documentos</b> (docx, xlsx, pptx, OpenDocument e os antigos doc e rtf como texto simples) são desenhados pelo próprio programa, com títulos, listas, tabelas e imagens, então não é preciso ter Word nem Office. Formatos de vídeo e áudio que o motor não reproduz (HEVC, AVI, WMV, AC3, APE, WavPack, ALAC, AIFF ...) são convertidos na hora pelo ffmpeg incluído. No visualizador, <kbd>F7</kbd> procura texto, <kbd>N</kbd> e <kbd>P</kbd> mostram o próximo e o anterior arquivo da pasta, <kbd>Esc</kbd> fecha. Ele também funciona para arquivos dentro de arquivos compactados e em servidores (o arquivo é baixado antes para um lugar temporário).</p>
<h3>Editor (F4)</h3>
<p>Um editor de texto simples que preserva a codificação, o BOM e as quebras de linha do arquivo, com localizar e substituir. Edita arquivos dentro de arquivos zip e em servidores NAS, SSH, FTP e WebDAV e os salva de volta. <kbd>Shift+F4</kbd> cria um novo arquivo. A fonte e a tabulação ficam em Configuração > <b>Editor...</b>.</p>
<h3>Visualização rápida (Ctrl+Q)</h3>
<p>O outro painel mostra uma prévia do arquivo sob o cursor e acompanha o cursor. <kbd>Ctrl+Q</kbd> de novo traz de volta a lista de arquivos.</p>
<p>Outras formas de abrir um arquivo: <kbd>Enter</kbd> o executa com o aplicativo que o sistema tem para ele; Arquivos > <b>Abrir com o aplicativo padrão</b> faz o mesmo para qualquer arquivo.</p>`,
    },
    {
      id: 'media', t: 'Música e vídeo',
      h: `<h3>Player de música</h3>
<p><kbd>Enter</kbd> em um arquivo de áudio inicia o player: uma barra aparece acima dos botões das teclas de função e a música continua tocando enquanto você navega. Os outros arquivos de áudio da pasta formam a fila. A barra tem anterior / pausa-reprodução / próximo, controle de posição, aleatório, repetir (desligado / todas / uma), volume e um botão que fecha o player.</p>
<ul>
<li>Atalhos: <kbd>Ctrl+Space</kbd> (macOS: <kbd>Option+Space</kbd>) pausa / reproduz, <kbd>Ctrl+Shift+Right</kbd> / <kbd>Ctrl+Shift+Left</kbd> próxima / faixa anterior. As teclas de mídia do teclado também funcionam. O menu Comandos tem os mesmos itens.</li>
<li>mp3, FLAC, WAV, OGG, Opus, AAC e M4A tocam diretamente; APE, WavPack, ALAC, AIFF, WMA, DSD, AC3, DTS, MPC e outros são decodificados pelo ffmpeg incluído.</li>
<li>A música de um painel NAS, SSH, FTP, WebDAV, Dropbox ou Google Drive é transmitida: começa na hora e você pode ir a qualquer ponto da faixa.</li>
</ul>
<h3>Música de chip (ZX Spectrum, Atari ST, Amstrad)</h3>
<p>O mesmo player toca módulos para o chip de som AY-3-8910 / YM2149: <b>PT3, PT2, PT1, STC, ST1, ST3, STP, SQT, ASC, PSC, PSM, FTC, GTR, AY, AYC, PSG, TSD, VTX e YM</b>. O chip é emulado; antes do primeiro som o programa prepara a faixa inteira (cerca de um segundo para alguns minutos de música, “rendering...” no título) e depois o avanço funciona como em qualquer outro arquivo. O título vem do módulo.</p>
<h3>Vídeo</h3>
<p><kbd>F3</kbd> ou <kbd>Enter</kbd> em um vídeo o abre no visualizador, com avanço e retrocesso, inclusive a partir de servidores e nuvens.</p>`,
    },
    {
      id: 'nas', t: 'Synology NAS',
      h: `<p><b>Rede > Synology NAS...</b> (<kbd>Ctrl+F</kbd>) conecta ao File Station de um Synology DiskStation e o mostra como um disco.</p>
<ol>
<li>Endereço: o endereço local com a porta do DSM (por exemplo <code>nas.local:5001</code> ou <code>192.168.1.20:5000</code>) ou um endereço <b>QuickConnect</b> (<code>https://id.region.quickconnect.to</code> ou só o id). O QuickConnect precisa de alguns segundos para achar o caminho até o NAS.</li>
<li>Usuário e senha; o código da <b>verificação em duas etapas</b>, se estiver ativada na conta.</li>
<li>“Permitir certificado não confiável” serve para um NAS com certificado autoassinado. “Lembrar a senha” a guarda criptografada pelo sistema operacional.</li>
<li><b>Conectar</b>. A conexão fica salva na lista à esquerda da janela; da próxima vez, clique duas vezes nela.</li>
</ol>
<p>No painel você pode navegar, copiar nos dois sentidos (com progresso), criar pastas, renomear, excluir, visualizar, editar e transmitir vídeo e música. <b>Rede > Desconectar (NAS / SSH)</b> encerra a conexão; a lista de unidades (<kbd>Alt+F1</kbd>) mostra as abertas e permite voltar a elas.</p>`,
    },
    {
      id: 'ssh', t: 'SSH, SFTP e o console',
      h: `<p><b>Rede > Servidor SSH...</b> (<kbd>Ctrl+Shift+F</kbd>) conecta com senha ou arquivo de chave (OpenSSH, PEM; chaves do PuTTY versão 2 são convertidas).</p>
<ul>
<li><b>Abrir como:</b> “Disco” mostra a lista de arquivos do servidor (SFTP), “Console” abre primeiro um terminal de verdade. <kbd>Ctrl+O</kbd> alterna entre eles a qualquer momento; o console mantém seu histórico.</li>
<li>No <b>console</b>, todas as teclas pertencem ao servidor, exceto <kbd>Ctrl+O</kbd>. Arquivos copiados com <kbd>F5</kbd> ou soltos no console são enviados para a pasta em que o console está agora.</li>
<li><b>Chave do host:</b> na primeira vez o programa mostra a impressão digital do servidor e pede para confiar; ela é lembrada e uma chave alterada é avisada (pode significar um ataque ou um servidor reinstalado).</li>
<li><b>Abrir no PuTTY</b> (menu Rede ou o botão da janela) inicia o PuTTY com a mesma conexão, se o PuTTY estiver instalado.</li>
<li>Arquivos remotos podem ser visualizados, editados, copiados e arrastados do painel para outro aplicativo.</li>
</ul>
<h3>Importar do WinSCP</h3>
<p><b>Rede > Importar do WinSCP...</b> lê as sessões do WinSCP (do registro ou de um arquivo <code>WinSCP.ini</code> que você escolher) e cria conexões: sessões SFTP / SCP viram conexões SSH (os arquivos de chave são copiados para a pasta protegida do programa), sessões FTP e WebDAV viram conexões FTP e WebDAV. As senhas não são importadas: digite-as na primeira conexão. Sessões S3 não são suportadas.</p>`,
    },
    {
      id: 'ftp', t: 'FTP, FTPS e WebDAV',
      h: `<h3>FTP e FTPS</h3>
<p><b>Rede > Servidor FTP / FTPS...</b></p>
<table>
<tr><td>Host</td><td>o nome do servidor, opcionalmente com porta: <code>ftp.example.com</code> ou <code>ftp.example.com:2121</code></td></tr>
<tr><td>Segurança</td><td><b>FTP sobre TLS (explícito)</b> é o recomendado: porta 21, a conexão é elevada para TLS. <b>TLS implícito</b> é a porta 990. <b>FTP simples</b> envia a senha sem criptografia: use apenas em uma rede confiável.</td></tr>
<tr><td>Usuário, Senha</td><td>ou pressione <b>Login anônimo</b> (usuário <code>anonymous</code>, uma senha no formato de e-mail).</td></tr>
<tr><td>Pasta remota</td><td>opcional: a pasta a abrir primeiro, por exemplo <code>/public_html</code></td></tr>
<tr><td>Pasta local</td><td>opcional: o outro painel vai para esta pasta quando você conecta.</td></tr>
<tr><td>Manter conexão</td><td>opcional: enviar um NOOP a cada N segundos para que um servidor com limite curto de inatividade não feche a conexão. (Uma conexão fechada pelo servidor é aberta de novo sozinha.)</td></tr>
<tr><td>Após o login</td><td>comandos FTP opcionais enviados depois do login, separados por <code>;</code></td></tr>
</table>
<p>“Permitir certificado não confiável” serve para um servidor com certificado TLS autoassinado. O programa usa o modo passivo (o que funciona através de roteadores e firewalls).</p>
<h3>WebDAV</h3>
<p><b>Rede > Servidor WebDAV...</b> aceita o endereço completo da pasta WebDAV: Nextcloud / ownCloud <code>https://cloud.example.com/remote.php/dav/files/NOME/</code>, Synology, Apache, nginx, IIS, Box e outros. O login pode ser Basic ou Digest; usuário vazio conecta sem login. Um redirecionamento para outro servidor não leva sua senha junto.</p>
<p>Os dois tipos funcionam como os painéis NAS e SSH: navegar, copiar nos dois sentidos com progresso, criar, renomear, excluir, visualizar, editar e transmitir vídeo e música com avanço e retrocesso. Observações: um servidor que não informa datas de modificação mostra datas vazias; os nomes são esperados em UTF-8; não há bloqueio de arquivos no WebDAV.</p>`,
    },
    {
      id: 'cloud', t: 'Dropbox e Google Drive',
      h: `<p><b>Rede > Dropbox...</b> e <b>Rede > Google Drive...</b> mostram a nuvem como um disco comum. Não é preciso o aplicativo de desktop do Dropbox ou do Google.</p>
<ol>
<li>Pressione o botão de login: o navegador abre, entre na página do Dropbox ou do Google e pressione Permitir. A senha nunca vai para este programa.</li>
<li>Quando o navegador disser que você entrou, volte ao programa; os arquivos aparecem no painel.</li>
<li>“Manter conectado neste computador” guarda um token de atualização (criptografado pelo sistema operacional) para que da próxima vez baste <b>Conectar</b>. “Usar outra conta” faz o login de novo.</li>
</ol>
<p>Você pode navegar, copiar nos dois sentidos, criar, renomear, excluir, visualizar, editar e transmitir. Os documentos próprios do Google (Docs, Planilhas, Apresentações) são exportados ao serem copiados. O Dropbox guarda os arquivos excluídos por 30 dias; o Google Drive os move para a Lixeira.</p>
<p class="help-warn">Dropbox e Google querem que cada programa se identifique com uma chave de aplicativo própria. As versões normais já a contêm e basta entrar. Se a janela pedir uma “App key” ou um “Client ID”, pressione “Configurações e ajuda...” nela: explica em poucos passos como criar uma chave gratuita uma vez no console do serviço (o valor é lembrado para todas as contas).</p>`,
    },
    {
      id: 'sync', t: 'Sincronização de configurações',
      h: `<p>Configuração > <b>Sincronização de configurações (Dropbox, Google Drive, pasta)...</b> mantém suas configurações iguais em todos os seus computadores. Elas ficam em um arquivo zip, <code>/Commander/settings.zip</code>, no seu Dropbox ou Google Drive, ou em uma pasta neste computador (um pendrive ou uma pasta que outro programa sincroniza).</p>
<ul>
<li>O que é sincronizado: conexões, favoritos, predefinições de busca e de renomeação, idioma e configurações de exibição. Na mescla de dois computadores, a alteração mais nova de cada configuração vence.</li>
<li><b>Manter as configurações lá:</b> sincroniza ao iniciar o programa e após cada alteração. <b>Sincronizar agora</b> mescla uma vez; <b>Obter configurações</b> e <b>Salvar configurações</b> forçam um sentido (pegar as configurações do outro computador ou sobrescrevê-las com estas).</li>
<li><b>Colocar senhas, logins e arquivos de chave SSH no zip:</b> sem isso só viajam os nomes e endereços das conexões. Com isso, proteja o zip com uma senha (AES-256, a mesma em todos os computadores); sem senha, qualquer pessoa que consiga abrir esse lugar pode ler suas senhas. Uma senha esquecida não pode ser recuperada.</li>
</ul>
<p class="help-tip">Use para o zip uma senha em ASCII, sem aspas e sem barras invertidas: ela é passada ao 7-Zip.</p>`,
    },
    {
      id: 'tools', t: 'Ferramentas dos menus Arquivos e Comandos',
      h: `<ul>
<li><b>Comparar diretórios</b> (<kbd>Shift+F2</kbd>): seleciona o que é diferente entre os dois painéis. <b>Sincronizar diretórios...</b> (menu Comandos) lista as diferenças de duas pastas com suas subpastas e copia os arquivos que faltam ou que são mais novos, no sentido que você escolher. As duas ferramentas precisam de duas pastas normais.</li>
<li><b>Comparar por conteúdo...</b> (menu Arquivos): dois arquivos lado a lado, com as diferenças marcadas.</li>
<li><b>Renomear em massa</b> (<kbd>Ctrl+M</kbd>), <b>Alterar atributos...</b> (somente leitura, oculto, sistema, arquivo, datas, também em subpastas), <b>Propriedades</b> (<kbd>Alt+Enter</kbd>), <b>Calcular espaço ocupado...</b> (<kbd>Ctrl+L</kbd>).</li>
<li><b>Editar comentário...</b> (<kbd>Ctrl+Z</kbd>): uma descrição do arquivo, guardada em <code>descript.ion</code> como no Total Commander e mostrada no painel.</li>
<li><b>Criar arquivos de checksum...</b> e <b>Verificar checksums...</b>: MD5, SHA-1, SHA-256 e outros; uma janela de progresso e a lista de arquivos danificados ou ausentes.</li>
<li><b>Dividir arquivo...</b> / <b>Combinar arquivos...</b>: corta um arquivo grande em partes de um tamanho escolhido e junta de novo (um arquivo <code>.crc</code> guarda a ordem e as somas de verificação).</li>
<li><b>Codificar / Decodificar arquivo (MIME, UUE)</b>: transforma um arquivo binário em texto para e-mail e vice-versa.</li>
<li><b>Programas de inicialização...</b> (menu Comandos): mostra o que inicia junto com o computador (programas de inicialização), no estilo do Sysinternals Autoruns.</li>
</ul>`,
    },
    {
      id: 'extras', t: 'Mais recursos',
      h: `<ul>
<li><b>Emulador de ZX Spectrum:</b> <kbd>Enter</kbd> em um arquivo <code>.trd .scl .tap .tzx .z80 .sna .szx .fdi .td0 .udi .csw .hob</code> o inicia no emulador incluído (Unreal Speccy Portable); Arquivos > <b>Executar no emulador ZX Spectrum</b> faz o mesmo.</li>
<li><b>WSL como disco:</b> as distribuições Linux instaladas aparecem na lista de unidades como “WSL: nome”; qualquer caminho <code>\\\\wsl$\\nome\\...</code> é uma pasta comum.</li>
<li><b>Arrastar e soltar:</b> arraste arquivos de um painel para outro aplicativo (de discos remotos eles são baixados antes). Arquivos soltos no console SSH são enviados para a pasta atual dele.</li>
<li><b>Barra de ferramentas:</b> a fileira de botões abaixo do menu pode ser mostrada ou ocultada em Configuração > Mostrar barra de ferramentas.</li>
<li><b>Caixas de diálogo em janelas próprias:</b> como no Total Commander, uma caixa de diálogo pode sair da janela principal. Isso pode ser desligado em Configuração > Configuração..., seção “Exibição”.</li>
<li><b>Idiomas da interface:</b> inglês, russo, ucraniano, bielorrusso, polonês, português, espanhol e alemão (Configuração > Idioma...). Menus, caixas de diálogo, botões e esta ajuda seguem o idioma; os nomes de arquivos nunca são traduzidos.</li>
</ul>`,
    },
    {
      id: 'keys', t: 'Atalhos de teclado',
      h: '',
    },
    {
      id: 'config', t: 'Configuração e atualizações',
      h: `<ul>
<li><b>Configuração...</b> tem os grupos de opções (exibição, operações, editor, idioma, ferramentas). <b>Atalhos de teclado...</b> permite dar outras teclas a cada comando, <b>Editor...</b> ajusta o editor, <b>Idioma...</b> muda o idioma (a janela do programa reinicia).</li>
<li><b>Verificar atualizações...</b> (menu Configuração): o programa também procura uma versão nova poucos segundos depois de iniciar e oferece instalá-la. No Windows, o novo programa portátil substitui o arquivo antigo depois de conferir o SHA-256; no Linux o novo AppImage faz o mesmo; no Mac o instalador de uma linha roda dentro do programa. Você pode ignorar uma versão.</li>
<li><b>Índice de arquivos...</b> e <b>Sincronização de configurações...</b> (menu Configuração) são descritos em capítulos próprios.</li>
<li><b>Sobre</b> > <b>Sobre o Alternate Commander...</b> mostra sua versão e as novidades da última versão. Há uma chave de <b>Modo de desenvolvedor</b>: ela abre uma janela com um registro detalhado de sincronização, atualizações e trabalho com arquivos compactados, o que ajuda ao relatar um problema.</li>
</ul>
<p>As configurações, os favoritos e as conexões salvas ficam na pasta de dados do programa (chamada <code>Commander</code>, dentro da pasta de dados de aplicativos do seu usuário). O programa portátil do Windows os guarda ao lado dele, em <code>Commander-data</code>. As senhas salvas ficam criptografadas, veja “Senhas, privacidade e segurança”.</p>`,
    },
    {
      id: 'platforms', t: 'Windows, macOS e Linux',
      h: `<h3>Windows</h3>
<p>Windows 10 / 11, 64 bits. O programa portátil não precisa de instalação. As versões ainda não têm assinatura de código, então o SmartScreen pode avisar na primeira vez: escolha <b>Mais informações</b> e <b>Executar assim mesmo</b>. Instalação com o Scoop: <code>scoop bucket add powervac https://github.com/powervac/scoop-bucket</code> e <code>scoop install alternate-commander</code>.</p>
<h3>macOS</h3>
<p>Apple Silicon e Intel. O mais fácil: <code>curl -fsSL https://altcom.cc/install-mac.sh | bash</code> no Terminal (também evita a mensagem de “danificado” dos aplicativos sem assinatura) ou <code>brew install --cask powervac/tap/alternate-commander</code>. Se o macOS disser que o aplicativo está danificado: <code>xattr -cr /Applications/Commander.app</code>.</p>
<ul>
<li><b>Ctrl é Cmd e Alt é Option</b> em todos os atalhos desta ajuda, exceto <kbd>Ctrl+Q</kbd> (visualização rápida) e as teclas do console SSH, que continuam Ctrl. <kbd>Cmd+A</kbd> seleciona todos os arquivos, <kbd>Cmd+W</kbd> fecha uma aba, <kbd>Cmd+M</kbd> é renomear em massa, <kbd>Cmd+Q</kbd> sai.</li>
<li>As teclas F precisam de <kbd>Fn</kbd>, ou ative “Usar as teclas F1, F2 etc. como teclas de função padrão” em Ajustes do Sistema > Teclado. Os botões na parte inferior da janela e os menus fazem o mesmo.</li>
<li>Na primeira vez que o programa lê Documentos, Downloads ou a Mesa, o macOS pede permissão. Os compartilhamentos de rede estão na lista de unidades, em <code>/Volumes</code>.</li>
</ul>
<h3>Linux</h3>
<p>x86_64. <code>curl -fsSL https://altcom.cc/install-linux.sh | bash</code> instala o programa em <code>~/Applications</code> e o adiciona ao menu de aplicativos; ou baixe o AppImage e dê <code>chmod +x</code> nele. Se o sistema não tiver chaveiro, as senhas salvas são protegidas por um arquivo de chave do programa.</p>`,
    },
    {
      id: 'security', t: 'Senhas, privacidade e segurança',
      h: `<ul>
<li><b>Senhas salvas</b> são opcionais (“Lembrar a senha”) e guardadas criptografadas pelo sistema operacional (Windows DPAPI, Chaves do macOS, chaveiro do Linux). Elas são enviadas apenas ao servidor ao qual você se conecta.</li>
<li><b>O login na nuvem</b> acontece no seu navegador; o programa guarda apenas um token de atualização. Seus arquivos vão diretamente entre este computador e o serviço, nunca por um servidor deste programa.</li>
<li><b>SSH</b> confia em uma chave de host na primeira vez e avisa quando ela muda. <b>FTPS</b> e <b>HTTPS</b> verificam o certificado do servidor; “Permitir certificado não confiável” desliga essa verificação para uma conexão, use só para um servidor que você conhece.</li>
<li><b>FTP simples</b> e endereços WebDAV <b>http://</b> enviam a senha sem criptografia.</li>
<li>A transmissão de mídia dos servidores escuta apenas neste computador (127.0.0.1) e exige uma chave aleatória criada a cada inicialização.</li>
<li>O programa procura atualizações em <code>altcom.cc</code> e baixa apenas arquivos cujo SHA-256 confere.</li>
<li>Sincronização de configurações com senhas: use a senha do zip (veja “Sincronização de configurações”).</li>
</ul>`,
    },
    {
      id: 'trouble', t: 'Solução de problemas e perguntas',
      h: `<h3>Não consigo conectar ao meu servidor NAS, SSH, FTP ou WebDAV</h3>
<p>Leia a mensagem na janela de conexão, ela cita as causas habituais. “Connection refused” significa porta errada ou serviço parado, “did not answer in time” um firewall ou endereço errado, “Login failed” usuário ou senha errados. “The server certificate is not trusted”: o servidor usa um certificado autoassinado; marque “Permitir certificado não confiável” se confiar nele. No QuickConnect, dê alguns segundos; se continuar falhando, tente o endereço local com a porta.</p>
<h3>Uma conexão FTP mostra a lista, mas falha nos arquivos</h3>
<p>O programa usa o modo passivo; um firewall que bloqueia as portas das conexões de dados passivas interrompe a transferência. Tente “FTP simples” uma vez para ver se o TLS é a causa, ou peça ao administrador para abrir a faixa de portas passivas.</p>
<h3>Um vídeo ou uma música não toca</h3>
<p>Formatos que o motor não conhece são convertidos pelo ffmpeg incluído; se o arquivo estiver danificado ou usar um codec muito raro, o visualizador avisa. Em um computador lento, dê um instante para um vídeo grande começar.</p>
<h3>As teclas não funcionam no macOS</h3>
<p>Veja “Windows, macOS e Linux”: as teclas F precisam de Fn, e Ctrl nesta ajuda significa Cmd.</p>
<h3>O idioma do programa está errado</h3>
<p>Configuração > Idioma... Se a sincronização de configurações estiver ativa, o idioma de outro computador pode ter sido assumido: mude de novo.</p>
<h3>Uma janela de diálogo sumiu ou está na tela errada</h3>
<p>As caixas de diálogo são janelas separadas; feche com Esc e abra de novo, ou desligue a opção em Configuração > Configuração..., seção “Exibição”.</p>
<h3>Relatar um problema ou pedir um recurso</h3>
<p>Use o formulário em <a href="#" data-u="https://altcom.cc/#requests">altcom.cc</a> ou abra um issue no <a href="#" data-u="https://github.com/powervac/Alternate-Total-Commander/issues">GitHub</a>. Ative o <b>Modo de desenvolvedor</b> em Sobre, repita o problema e junte as linhas do registro ao seu relato.</p>`,
    },
    {
      id: 'about', t: 'Sobre o programa',
      h: `<p>O <b>Alternate Commander</b> é um gerenciador de arquivos de dois painéis, gratuito e de código aberto, para Windows, macOS e Linux, no estilo do Total Commander. É um projeto independente, sem vínculo com o Total Commander ou a Ghisler Software.</p>
<ul>
<li>Site: <a href="#" data-u="https://altcom.cc">altcom.cc</a>; novidades de cada versão: <a href="#" data-u="https://altcom.cc/changelog.html">histórico de alterações</a>.</li>
<li>Código-fonte e issues: <a href="#" data-u="https://github.com/powervac/Alternate-Total-Commander">github.com/powervac/Alternate-Total-Commander</a> (licença MIT).</li>
<li>Feito com Electron. Componentes de terceiros: o emulador de ZX Spectrum Unreal Speccy Portable (GPL-3.0), ffmpeg e 7-Zip para conversão e arquivos compactados, xterm.js para o console SSH, ssh2 e basic-ftp para as conexões e a fonte Inter. A lista completa está no README do projeto.</li>
</ul>
<p>Sua versão e a verificação de atualizações estão em <b>Sobre > Sobre o Alternate Commander...</b>.</p>`,
    },
  ],
};
