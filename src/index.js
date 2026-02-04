export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle the submission endpoint
    if (url.pathname === '/api/submit' && request.method === 'POST') {
      try {
        const { topic } = await request.json();

        // Run the Llama 3.3 model on Workers AI
        const aiResponse = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            { role: 'system', content: 'You are a helpful assistant. Keep answers concise (under 100 words).' },
            { role: 'user', content: `Explain this topic simply: ${topic}` }
          ]
        });
        const summary = aiResponse.response;

        // Persist the result to D1
        await env.DB.prepare('INSERT INTO results (topic, summary) VALUES (?, ?)')
          .bind(topic, summary)
          .run();

        return new Response(JSON.stringify({ status: 'success', topic, summary }), {
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (e) {
        // Return 500 on failure for frontend handling
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Endpoint to retrieve past results
    if (url.pathname === '/api/history') {
      const { results } = await env.DB.prepare('SELECT * FROM results ORDER BY id DESC').all();
      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Serve the static frontend
    return new Response(renderHTML(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
};

function renderHTML() {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>InsightGen AI</title>
    <style>
      :root { --primary: #2563eb; --bg: #f8fafc; --card: #ffffff; --text: #1e293b; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); padding: 20px; display: flex; flex-direction: column; align-items: center; }
      .container { width: 100%; max-width: 600px; }
      h1 { text-align: center; margin-bottom: 2rem; }
      .card { background: var(--card); border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin-bottom: 20px; }
      
      /* Updated Input Group for Mobile Responsiveness */
      .input-group { display: flex; gap: 10px; flex-wrap: wrap; }
      
      input { 
        flex-grow: 1; 
        padding: 12px; 
        border: 1px solid #cbd5e1; 
        border-radius: 8px; 
        font-size: 16px; 
        min-width: 0; /* Prevents overflow issues */
      }
      
      button { 
        background: var(--primary); 
        color: white; 
        border: none; 
        padding: 12px 24px; 
        border-radius: 8px; 
        font-size: 16px; 
        font-weight: 600; 
        cursor: pointer;
        flex-shrink: 0; /* Prevents button from getting squished */
      }

      /* On very small screens (phones), stack them vertically */
      @media (max-width: 480px) {
        .input-group { flex-direction: column; }
        button { width: 100%; }
      }

      button:disabled { background: #94a3b8; }
      ul { list-style: none; padding: 0; }
      li { border-bottom: 1px solid #f1f5f9; padding: 16px 0; }
      
      .progress-box { display: none; text-align: center; margin-top: 20px; }
      .circular-loader {
        width: 60px; height: 60px; border-radius: 50%;
        background: conic-gradient(var(--primary) var(--progress, 0%), #e2e8f0 0%);
        display: inline-flex; align-items: center; justify-content: center;
        position: relative; margin: 0 auto;
        transition: background 0.2s;
      }
      .circular-loader::before {
        content: attr(data-value) '%';
        position: absolute; background: white;
        width: 48px; height: 48px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 14px; font-weight: bold; color: var(--primary);
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>✨ InsightGen AI</h1>
      <div class="card">
        <div class="input-group">
          <input type="text" id="topicInput" placeholder="Enter a topic (e.g. Quantum Physics)">
          <button id="btn" onclick="submitTopic()">Generate</button>
        </div>
        
        <div class="progress-box" id="progressBox">
          <div class="circular-loader" id="loader" data-value="0" style="--progress: 0%"></div>
          <p id="progressText" style="color: #64748b; margin-top: 10px;">Initializing...</p>
        </div>
      </div>

      <div class="card">
        <h3>Recent Insights</h3>
        <ul id="historyList"><li>Loading...</li></ul>
      </div>
    </div>
    <script>
      async function submitTopic() {
        const topic = document.getElementById('topicInput').value;
        if (!topic) return;

        // Reset UI state
        document.getElementById('btn').disabled = true;
        document.getElementById('progressBox').style.display = 'block';
        
        const loader = document.getElementById('loader');
        const progressText = document.getElementById('progressText');
        let percent = 0;

        // Simulate progress during API latency
        const interval = setInterval(() => {
          if (percent < 95) {
            percent += Math.floor(Math.random() * 2) + 1;
            loader.style.setProperty('--progress', percent + '%');
            loader.setAttribute('data-value', percent);
            
            // Update status text based on progress
            if (percent > 20) progressText.innerText = "Reading docs...";
            if (percent > 50) progressText.innerText = "Analyzing data...";
            if (percent > 80) progressText.innerText = "Writing summary...";
          }
        }, 150);

        try {
          const res = await fetch('/api/submit', { 
            method: 'POST', 
            body: JSON.stringify({ topic }), 
            headers: {'Content-Type': 'application/json'} 
          });
          
          const data = await res.json();
          clearInterval(interval);

          if (data.error) {
            alert("Error: " + data.error);
            resetUI();
          } else {
            // Complete animation and refresh list
            loader.style.setProperty('--progress', '100%');
            loader.setAttribute('data-value', '100');
            progressText.innerText = "Done!";
            
            setTimeout(() => {
              fetchHistory();
              resetUI();
            }, 800);
          }
        } catch (e) {
          clearInterval(interval);
          alert("Network Error");
          resetUI();
        }
      }

      function resetUI() {
        document.getElementById('btn').disabled = false;
        document.getElementById('progressBox').style.display = 'none';
        document.getElementById('topicInput').value = '';
        
        // Reset loader
        document.getElementById('loader').style.setProperty('--progress', '0%');
        document.getElementById('loader').setAttribute('data-value', '0');
      }

      async function fetchHistory() {
        const res = await fetch('/api/history');
        const data = await res.json();
        const list = document.getElementById('historyList');
        if (data.length === 0) {
          list.innerHTML = '<li style="color:#94a3b8; text-align:center">No history yet.</li>';
        } else {
          list.innerHTML = data.map(i => '<li><strong>' + i.topic + '</strong><br>' + i.summary + '</li>').join('');
        }
      }
      fetchHistory();
    </script>
  </body>
  </html>
  `;
}