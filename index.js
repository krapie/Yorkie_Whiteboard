// global elements
const shortUniqueID = new ShortUniqueId();
const statusHolder = document.getElementById('network-status');
const drawingPanel = document.getElementById('drawing-panel');
const placeholder = document.getElementById('placeholder');
const logHolder = document.getElementById('log-holder');
const peersHolder = document.getElementById('peers-holder');
const brush = document.getElementById('brush-button');
const eraser = document.getElementById('eraser-button');
const clearButton = document.getElementById('clear-button');
const brushRange = document.getElementById('brush-size-range')

// global variables
const INITIAL_LINEWIDTH = 5;
const MODE_BUTTON = [brush, eraser];
let mode = brush;

const context = drawingPanel.getContext('2d');
context.lineWidth = INITIAL_LINEWIDTH;

// global functions
function paintCanvas(shapes) {
  // TODO Now repainting the whole thing. Only changed parts should be drawn.
  context.clearRect(0, 0, drawingPanel.width, drawingPanel.height);

  for (const shape of shapes) {
    context.beginPath();
    let isMoved = false; 
    for (const p of shape.points) {
      if (isMoved === false) {
        isMoved = true; 
        context.moveTo(p.x, p.y);
      } else {
        context.lineTo(p.x, p.y);
      }
    }

    context.stroke();
  }
}

function eraseCanvas(e) {
    const x = e.offsetX;
    const y = e.offsetY;

    context.clearRect(x-context.lineWidth/2, y-context.lineWidth/2, context.lineWidth, context.lineWidth);
}

function getPoint(e) {
  return {
    x: e.clientX - (drawingPanel.offsetLeft) + window.scrollX,
    y: e.clientY - (drawingPanel.offsetTop) + window.scrollY
  };
}

function displayPeers(peers, username) {
  const usernames = [];

  for (const [_, peer] of Object.entries(peers)) {
    usernames.push(peer['username']);
  }

  peersHolder.innerHTML = JSON.stringify(usernames).replace(username, `<b>${username}</b>`);
}

const handleModeChange = (e) => {
    mode = e.target;
    
    // Button Highlight
    for(i = 0 ; i < MODE_BUTTON.length ; i++){
        var button = MODE_BUTTON[i];
        if(button === mode){
            button.style.backgroundColor = "skyblue";
        }
        else {
            button.style.backgroundColor = "white";
        }
    }
}

const handleRangeChange = (e) => {
    const size = e.target.value;
    context.lineWidth = size;
    brushRange.value = size;
}

// global listeners
MODE_BUTTON.forEach(mode => mode.addEventListener('click', handleModeChange));
brushRange.addEventListener('input', handleRangeChange);

// main
async function main() {
  let peers;
  const metadata = {username: `username-${shortUniqueID()}`};

  try {
    // 01. create client with RPCAddr(envoy) then activate it.
    const client = yorkie.createClient('http://121.130.91.176:8080', {
      metadata,
      syncLoopDuration: 0,
      reconnectStreamDelay: 1000
    });
    client.subscribe(network.statusListener(statusHolder));
    await client.activate();

    client.subscribe((event) => {
      if (event.type === 'peers-changed') {
        peers = event.value[doc.getKey()];
        displayPeers(peers, metadata['username']);
      }
    });

    // 02. create a document then attach it into the client.
    const doc = yorkie.createDocument('drawing-panel', 'drawing-1');
    await client.attach(doc);

    doc.update((root) => {
      if (!root['shapes']) {
        root['shapes'] = [];
      }
    }, 'create points if not exists');

    doc.subscribe((event) => {
        paintCanvas(doc.getRoot().shapes);
    });
    await client.sync();

    // 03. set functions
    const downEvent = (e) => {
        if (!window.isMouseDown) {
            window.isMouseDown = true; 
            const point = getPoint(e);
            if (point.x < 0 || point.y < 0 ||
                point.x > drawingPanel.width || point.y > drawingPanel.height) {
              return;
            }
    
            doc.update((root) => {
              root.shapes.push({
                points: [point]
              });
              const shape = root.shapes.getLast();
              window.currentID = shape.getID();
            }, `update content by ${client.getID()}`);
          }
    }

    const moveEvent = (e) => {
        if (window.isMouseDown) {
            const point = getPoint(e);
            if (point.x < 0 || point.y < 0 ||
                point.x > drawingPanel.width || point.y > drawingPanel.height) {
              return;
            }
    
            // brush mode일 경우
            if(mode === brush) {    
                doc.update((root) => {
                  const shape = root.shapes.getElementByID(window.currentID);
                  shape.points.push(point);
                  paintCanvas(root.shapes);
                }, `update content by ${client.getID()}`);
            }
            // eraser mode일 경우
            else if(mode === eraser){
                doc.update((root) => {
                    const shape = root.shapes.getElementByID(window.currentID);
                    //shape.points.pop(point);
                    eraseCanvas(e);
                  }, `update content by ${client.getID()}`);
            }
          }
    }

    const upEvent = (e) => {
        if (window.isMouseDown) {
            window.isMouseDown = false;   
          }
    }

    // 04. add event handlers
    document.addEventListener('mousedown', downEvent);
    document.addEventListener('mousemove', moveEvent);
    document.addEventListener('mouseup', upEvent);

    clearButton.addEventListener('click', () => {
        context.clearRect(0, 0, drawingPanel.width, drawingPanel.height);
        context.beginPath();
    
        doc.update((root) => {
          root['shapes'] = [];
      }, `clear content by ${client.getID()}`);
    });

    // 05. set initial value.
    paintCanvas(doc.getRoot().shapes);
  } catch (e) {
    console.error(e);
  }
}

main();