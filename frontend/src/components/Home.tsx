import { useRef, useState, type DragEvent } from 'react'

interface Props {
  error?: string
  onFile: (file: File) => void
  onSample: () => void
}

export default function Home({ error, onFile, onSample }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const drop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  return (
    <main className="home">
      <div className="blob" style={{ background: 'var(--violet)', width: 420, height: 420, right: -160, top: -120 }} />
      <div className="blob" style={{ background: 'var(--coral)', width: 160, height: 160, right: 140, top: 260 }} />

      <section className="home-hero">
        <span className="home-tag">retrospectiva {new Date().getFullYear()}</span>
        <h1>
          O ano do seu <em>grupo</em> em números
        </h1>
        <p className="home-lead">
          Quem mais fala, quem vive mandando áudio, o kkkk mais longo, a dupla inseparável e um prêmio pra cada um.
        </p>

        <div
          className={`drop${over ? ' over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
        >
          <button className="btn" onClick={() => input.current?.click()}>
            Escolher a conversa exportada
          </button>
          <p>Arquivo .txt ou .zip exportado do WhatsApp. Também dá pra arrastar aqui.</p>
          <input
            ref={input}
            type="file"
            accept=".txt,.zip,text/plain,application/zip"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onFile(file)
              e.target.value = ''
            }}
          />
          {error && <div className="error">{error}</div>}
          <div className="home-actions">
            <button className="btn ghost small" onClick={onSample}>
              Ver um exemplo antes
            </button>
          </div>
        </div>
      </section>

      <section className="how">
        <div className="how-card android">
          <h3>No Android</h3>
          <ol>
            <li>Abra o grupo e toque nos três pontinhos</li>
            <li>Mais → Exportar conversa → Sem mídia</li>
            <li>Salve o arquivo (no Drive ou em Arquivos)</li>
            <li>Volte aqui e escolha o arquivo</li>
          </ol>
        </div>
        <div className="how-card iphone">
          <h3>No iPhone</h3>
          <ol>
            <li>Abra o grupo e toque no nome dele</li>
            <li>Role até Exportar conversa → Sem mídia</li>
            <li>Escolha "Salvar em Arquivos"</li>
            <li>Volte aqui e escolha o .zip</li>
          </ol>
        </div>
        <div className="how-card privacy">
          <h3>A conversa não sai do seu celular</h3>
          <p>
            Tudo é calculado aqui mesmo, no navegador. Nenhuma mensagem é enviada pra servidor nenhum. Se você gerar um link
            para o grupo, ele leva só os números, e você escolhe se quer incluir trechos.
          </p>
        </div>
      </section>

      <p className="home-foot">
        Exportar "com mídia" também funciona e separa figurinhas, áudios e fotos, mas o arquivo fica bem maior.
        <br />
        <a href="https://github.com/CarlosRRocha003/wpp-chat-retrospective" target="_blank" rel="noreferrer">
          Código aberto no GitHub
        </a>
        . Projeto independente, sem relação com o WhatsApp.
      </p>
    </main>
  )
}
