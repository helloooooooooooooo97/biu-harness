import './style.css'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app missing')

app.innerHTML = `
  <main>
    <h1>hmr-dev</h1>
    <p>空项目已就绪。改 src/main.ts 即可看到 Vite HMR。</p>
  </main>
`
