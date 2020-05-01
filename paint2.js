class Picture{
    constructor(state, pixels){
        this.state = state;
        this.width = state.tilesx * 8;
        this.height = state.tilesy * 8;
        this.pixels = pixels;
    }
    static empty(state, color){
        let pixels = new Array(state.tilesx * 8 * state.tilesy * 8).fill(color);
        return new Picture(state, pixels);
    }
    pixel(x, y){
        return this.pixels[x + y * this.width];
    }
    draw(pixels){
        let copy = this.pixels.slice();
        for(let {x, y, color} of pixels){
            copy[x + y * this.width] = color;
        }
        return new Picture(this.state, copy);
    }
}

function updateState(state, action){
    return Object.assign({}, state, action);
}
  
function elt(type, props, ...children){
    let dom = document.createElement(type);
    if(props) Object.assign(dom, props);
    for(let child of children){
      if(typeof child != "string" ) dom.appendChild(child);
      else dom.appendChild(document.createTextNode(child));
    }
    return dom;
}
  
const scale = 10;

class PictureCanvas{
    constructor(state, pointerDown){
        this.dom = elt("canvas", {
            id: "main_canvas",
            onmousedown: event => this.mouse(event, pointerDown),
            ontouchstart: event => this.touch(event, pointerDown)
        });
        //console.log(this.dom);
        this.syncState(state);
    }
    // syncState(picture){
    //     if (this.picture == picture) return;
    //     this.picture = picture;
    //     drawPicture(this.picture, this.dom, scale);
    // }
    syncState(state){
        //console.log(this.picture);
        //console.log(state.picture);
        if (this.picture == state.picture && this.state == state) return;
        this.picture = state.picture;

        drawPicture(this.picture, this.dom, scale, state.grid);
    }
}
  
function drawPicture(picture, canvas, scale, grid = 1){
    canvas.width = picture.width * scale;
    canvas.height = picture.height * scale;
    let cx = canvas.getContext("2d");

    for(let y = 0; y < picture.height; y++){
        for( let x = 0; x < picture.width; x++){
            cx.fillStyle = picture.pixel(x, y);
            cx.fillRect(x * scale, y * scale, scale, scale);
        }
    }

    //Рисуем потайловую сетку
    if(grid == 1) {
        for(let t = 0; t < (Math.floor(picture.width / 8)); t++){
            cx.beginPath();
            cx.moveTo(t*8*scale, 0);
            cx.lineTo(t*8*scale, picture.height*scale-1);
            cx.stroke();
        }
        for(let t = 0; t < (Math.floor(picture.height / 8)); t++){
            cx.beginPath();
            cx.moveTo(0, t*8*scale);
            cx.lineTo(picture.width*scale-1, t*8*scale);
            cx.stroke();
        }
    }
    //console.log("drawn");
}
  
PictureCanvas.prototype.mouse = function(downEvent, onDown){
    if(downEvent.button != 0) return;
    let pos = pointerPosition(downEvent, this.dom);
    let onMove = onDown(pos);
    if(!onMove) return;
    let move = moveEvent => {
        if(moveEvent.buttons == 0){
            this.dom.removeEventListener("mousemove", move);
        }else{
            let newPos = pointerPosition(moveEvent, this.dom);
            if(newPos.x == pos.x && newPos.y == pos.y) return;
            pos = newPos;
            onMove(newPos);
        }
    };
    this.dom.addEventListener("mousemove", move);
};

function pointerPosition(pos, domNode){
    let rect = domNode.getBoundingClientRect();
    return {x: Math.floor((pos.clientX - rect.left) / scale), 
            y: Math.floor((pos.clientY - rect.top) / scale)};
}

PictureCanvas.prototype.touch = function(startEvent, onDown) {
    let pos = pointerPosition(startEvent.touches[0], this.dom);
    let onMove = onDown(pos);
    startEvent.preventDefault();
    if (!onMove) return;
    let move = moveEvent => {
        let newPos = pointerPosition(moveEvent.touches[0],this.dom);
        if (newPos.x == pos.x && newPos.y == pos.y) return;
        pos = newPos;
        onMove(newPos);
    };
    let end = () => {
        this.dom.removeEventListener("touchmove", move);
        this.dom.removeEventListener("touchend", end);
    };
    this.dom.addEventListener("touchmove", move);
    this.dom.addEventListener("touchend", end);
};

class PixelEditor{
    constructor(state, config){
        let {tools, controls, dispatch} = config;
        this.state = state;
        this.canvas = new PictureCanvas(state, pos =>{
            let tool = tools[this.state.tool];
            let onMove = tool(pos, this.state, dispatch);
            if (onMove) return pos => onMove(pos, this.state);
        });
        this.controls = controls.map(Control => new Control(state, config));
        this.dom = elt("div", {id: "container"}, this.canvas.dom, elt("br"), ...this.controls.reduce((a,c) => a.concat(" ", c.dom), []));
    }
    syncState(state){
        this.state = state;
        this.canvas.syncState(state);
        //console.log(state.grid);
        for(let ctrl of this.controls) ctrl.syncState(state);
    }
}

class ToolSelect{
    constructor(state, {tools, dispatch}){
        this.select = elt("select", {
            onchange: () => dispatch({tool: this.select.value})
        }, ...Object.keys(tools).map(name => elt("option", {
            selected: name == state.tool
        },name)));
        this.dom = elt("label", null, "🖌 Инструмент:", this.select);
    }
    syncState(state) {this.select.value = state.tool;}
}

class ColorSelect{
    constructor(state, {dispatch}){
        this.input = elt("input", {
            type: "color",
            value: state.color,
            onchange: () => dispatch({color: this.input.value})
        });
        this.dom = elt("label", null, "🎨 Цвет:", this.input);
    }
    syncState(state){this.input.value = state.color;}
}

function draw(pos, state, dispatch){
    function drawPixel({x, y}, state){
        let drawn = {x, y, color:state.color};
        dispatch({picture: state.picture.draw([drawn])});
    }
    drawPixel(pos, state);
    return drawPixel;
}

function rectangle(start, state, dispatch){
    function drawRectangle(pos){
        let xStart = Math.min(start.x, pos.x);
        let yStart = Math.min(start.y, pos.y);
        let xEnd = Math.max(start.x, pos.x);
        let yEnd = Math.max(start.y, pos.y);
        let drawn = [];
        for(let y = yStart; y <= yEnd; y++){
            for(let x = xStart; x <= xEnd; x++){
                drawn.push({x, y, color: state.color});
            }
        }
        dispatch({picture: state.picture.draw(drawn)});
    }
    drawRectangle(start);
    return drawRectangle;
}

function circle(start, state, dispatch){
    function drawCircle(pos){
        //let rad = Math.min(Math.abs(start.x -  pos.x), Math.abs(start.y - pos.y));
        let rad = Math.floor(Math.sqrt(Math.pow(start.x -  pos.x, 2) + Math.pow(start.y -  pos.y, 2)));
        xStart = start.x - rad;
        yStart = start.y - rad;
        xEnd = start.x + rad;
        yEnd = start.y + rad;
        let drawn = [];
        for(let y = Math.max(yStart, 0); y <= Math.min(yEnd, state.picture.height);y++){
            for(let x = Math.max(xStart, 0); x < Math.min(xEnd, state.picture.width); x++){
                if(Math.sqrt(Math.pow(start.x -  x, 2) + Math.pow(start.y -  y, 2)) < rad ){
                    drawn.push({x, y, color: state.color});
                    //console.log(x + ',' + y);
                }
            }
        }
        dispatch({picture: state.picture.draw(drawn)});
    }
    drawCircle(start);
    return drawCircle;
}

function line(start, state, dispatch){
    function drawLine(pos){
        let coef = ( pos.y - start.y) / ( pos.x - start.x);
        drawn = [];
        if(Math.abs(coef) <= 1){
            let dir = (pos.x - start.x) > 0 ? 1:-1;
            for(let x = 0; x <= Math.abs(start.x - pos.x); x++ ){
                let y = start.y + Math.round(coef * x) * dir;
                let xd = start.x + x * dir;
                drawn.push({x:xd, y, color: state.color});
                //console.log("coef = " + coef + ", xd = " + xd + ", y = " + y + ", start.x = " + start.x + ", start.y = " + start.y + ", dir = " + dir + " typeof(xd) = " + typeof(xd));
            }
        } else {
            let dir = (pos.y - start.y) > 0 ? 1:-1;
            for(let y = 0; y <= Math.abs(start.y - pos.y);y++){
                let x = start.x + Math.round(y/coef) * dir;
                let yd = start.y + y * dir;
                drawn.push({x, y:yd, color: state.color});
                //console.log("coef = " + coef + ", x = " + x + ", yd = " + yd + ", start.x = " + start.x + ", start.y = " + start.y+ ", dir = " + dir+ " typeof(yd) = " + typeof(yd));
            }
        }
        dispatch({picture: state.picture.draw(drawn)});
    }
    drawLine(start);
    return drawLine;
}

const around = [{dx:-1, dy:0}, {dx:1, dy:0}, {dx:0, dy:-1}, {dx:0, dy:1}];

function fill({x, y}, state, dispatch){
    let targetColor = state.picture.pixel(x, y);
    let drawn = [{x, y, color:state.color}];
    for(let done = 0; done < drawn.length; done++){
        for(let {dx, dy} of around){
            let x = drawn[done].x + dx, y = drawn[done].y + dy;
            if( x >= 0 && x < state.picture.width && y >= 0 && y < state.picture.height && state.picture.pixel(x, y) == targetColor && !drawn.some(p => p.x == x && p.y == y) ){
                drawn.push({x, y, color: state.color});
            }
        }
    }
    dispatch({picture: state.picture.draw(drawn)});
}

function pick(pos, state, dispatch){
    dispatch({color: state.picture.pixel(pos.x, pos.y)});
}

class SaveButton{
    constructor(state){
        this.picture = state.picture;
        this.dom = elt("button", {
            onclick: () => this.save()
        }, "💾 Сохранить");
    }
    save(){
        let canvas = elt("canvas");
        drawPicture(this.picture, canvas, 1, 0);
        let link = elt("a", {
            href: canvas.toDataURL(),
            download: "pixelart.png"
        });
        document.body.appendChild(link);
        link.click();
        link.remove();
    }
    syncState(state){ this.picture = state.picture;}
}

class LoadButton{
    constructor(_, {dispatch}){
        this.dom = elt("button", {
            onclick: () => startLoad(dispatch)
        }, "📁 Загрузить");
    }
    syncState() {}
}

function startLoad(dispatch){
    let input = elt("input", {
        type: "file",
        onchange: () => finishLoad(input.files[0], dispatch)
    });
    document.body.appendChild(input);
    input.click();
    input.remove();
}

function finishLoad(file, dispatch){
    if(file == null) return;
    let reader = new FileReader();
    reader.addEventListener("load", () => {
        let image = elt("img", {
            onload: () => dispatch({
                picture: pictureFromImage(image)
            }),
            src: reader.result
        });
    });
    reader.readAsDataURL(file);
}



function pictureFromImage(image){
    let width = Math.min(100, image.width);
    let height = Math.min(100, image.height);
    let canvas = elt("canvas", {width, height});
    let cx = canvas.getContext("2d");
    cx.drawImage(image, 0, 0);
    let pixels = [];
    let {data} = cx.getImageData(0, 0, width, height);

    function hex(n){
        return n.toString(16).padStart(2, "0");
    }
    for(let i = 0; i < data.length; i += 4){
        let [r,g,b] = data.slice(i, i + 3);
        pixels.push("#" + hex(r) + hex(g) + hex(b));
    }
    return new Picture(width, height, pixels);
}

function historyUpdateState(state, action){
    if(action.undo == true){
        if(state.done.length == 0) return state;
        return Object.assign({}, state, {
            picture: state.done[0],
            done: state.done.slice(1),
            doneAt:0
        });
    } else if (action.picture && state.doneAt < Date.now() - 1000){
        return Object.assign({}, state, action, {
            done: [state.picture, ...state.done],
            doneAt: Date.now()
        });
    } else {
        return Object.assign({}, state, action);
    }
}

class UndoButton{
    constructor(state, {dispatch}){
        this.dom = elt("button", {
            onclick: () => dispatch({undo:true}),
            disabled: state.done.length == 0
        }, "⮪ Отменить");
    }
    syncState(state){
        this.dom.disabled = state.done.length == 0;
    }
}

class GridToggle{
    constructor(state, {dispatch}){
        this.grid = state.grid;
        this.picture = state.picture;
        this.dom = elt("button", {
            onclick: () => {
                this.grid = !this.grid;
                dispatch({grid: this.grid});
            }
        }, "#Сетка");
    }
    syncState(state){}
}

class TilesX{
    constructor(state, {dispatch}){
        this.tilesx = state.tilesx;
        this.input = elt("input", {
            type: "text",
            id: "tilesx",
            value: this.tilesx,
            onchange: () => {
                let newx = Number.parseInt(document.getElementById("tilesx").value);
                if(newx){
                    this.tilesx = newx;
                }
                //dispatch({tilesx: this.tilesx});
                state.tilesx = newx;
                state.picture = Picture.empty({tilesx: state.tilesx,tilesy:state.tilesy},"#f0f0f0") ;
                if (document.contains(document.getElementById("container"))){
                    document.getElementById("container").remove();
                    //console.log("removed");
                }
                document.querySelector("div").appendChild(startPixelEditor({state}));
                //console.log(state);
            }
        });
        this.dom = elt("label", null, "Тайлы X:", this.input);
    }
    syncState(state){}
}

class TilesY{
    constructor(state, {dispatch}){
        this.tilesy = state.tilesy;
        this.input = elt("input", {
            type: "text",
            id: "tilesy",
            value: this.tilesy,
            onchange: () => {
                let newy = Number.parseInt(document.getElementById("tilesy").value);
                if(newy){
                    this.tilesy = newy;
                }
                //dispatch({tilesx: this.tilesx});
                state.tilesy = newy;
                state.picture = Picture.empty({tilesx: state.tilesx,tilesy:state.tilesy},"#f0f0f0") ;
                if (document.contains(document.getElementById("container"))){
                    document.getElementById("container").remove();
                    //console.log("removed");
                }
                document.querySelector("div").appendChild(startPixelEditor({state}));
                //console.log(state);
            }
        });
        this.dom = elt("label", null, "Тайлы Y:", this.input);
    }
    syncState(state){}
}


const startState = {
    tool: "draw",
    color: "#000000",
    picture: Picture.empty({tilesx:12,tilesy:6},"#f0f0f0"),
    done: [],
    doneAt:0,
    grid: true,
    tilesx: 8,
    tilesy: 4
};

const baseTools = {draw, line, fill, rectangle, pick, circle};

const baseControls = [
    ToolSelect, ColorSelect, SaveButton, LoadButton, UndoButton, GridToggle, TilesX, TilesY
];

function startPixelEditor({state = startState, tools = baseTools, controls = baseControls}){
    let app = new PixelEditor(state, {
        tools,
        controls, 
        dispatch(action){
            state = historyUpdateState(state, action);
            app.syncState(state);
        }
    });
    return app.dom;
}