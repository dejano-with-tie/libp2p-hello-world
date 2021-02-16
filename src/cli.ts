import * as blessed from 'blessed';
// import * as Path from "path";

var screen = blessed.screen({
    autoPadding: true,
    smartCSR: true,
    useBCE: true,
    cursor: {
        artificial: true,
        blink: true,
        shape: 'underline',
        color: 'null'
    },
    // log: Path.join(__dirname, '..', 'gitter-cli-blessed.log'),
    // dump: true,
    fullUnicode: true,
    dockBorders: true,
    ignoreLocked: ['C-c']
});
screen.title = 'libp2p example';


var messageList = blessed.list({
    align: 'left',
    mouse: true,
    keys: true,
    width: '100%',
    height: '90%',
    top: 0,
    left: 0,
    scrollbar: {
        ch: ' ',
    },
    items: [],
});

// Append our box to the screen.
var input = blessed.textarea({
    bottom: 0,
    height: '10%',
    inputOnFocus: true,
    padding: {
        top: 1,
        left: 2,
    },
    style: {
        fg: '#787878',
        bg: '#454545',

        focus: {
            fg: '#f6f6f6',
            bg: '#353535',
        },
    },
});

input.key('enter', async function() {
    var message = input.getValue();
    try {
        console.log(`${message}`);
        messageList.addItem(`${message}`);
        messageList.scrollTo(100);
        screen.render();
    } catch (err) {
        // error handling
    } finally {
        input.clearValue();
        screen.render();
    }
});

// Append our box to the screen.
screen.key(['escape', 'q', 'C-c'], function() {
    return process.exit(0);
});

screen.append(messageList);
screen.append(input);
input.focus();


screen.key('q', function() {
    process.exit(0);
});


// Render the screen.
export default screen;