// main.js
// Hämta data från backend
fetch('http://localhost:4000/')
  .then(res => res.text())
  .then(data => {
    const container = document.createElement('div');
    container.style.margin = "20px";
    container.style.fontSize = "20px";
    container.innerText = `Backend says: ${data}`;
    document.body.appendChild(container);
  })
  .catch(err => {
    console.error('Error fetching backend:', err);
  });
