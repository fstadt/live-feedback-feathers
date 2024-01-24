import {feathers, Params} from '@feathersjs/feathers'
import { koa, rest, bodyParser, errorHandler, serveStatic } from '@feathersjs/koa'
import socketio from '@feathersjs/socketio'
import EventEmitter from "events";
import { v4 as uuidv4 } from 'uuid';

// These are the options for each question
type VoteOptions = "A" | "B" | "C" | "D";

// A voting service allowing us to create new sessions, vote and see results
class VotingService extends EventEmitter {
    votes: Record<VoteOptions, number> = {
        A: 0,
        B: 0,
        C: 0,
        D: 0
    };

    questionToken: string = uuidv4();

    async getQuestionToken(data: undefined, params: Params): Promise<string> {
        return this.questionToken;
    }

    // Reset all votes (needs to be authenticated by secret
    async reset(data: {secret: string}, params: Params) {
        this.votes = {
            A: 0,
            B: 0,
            C: 0,
            D: 0
        };

        this.questionToken = uuidv4();

        // Emit reset event
        this.emit('reset', this.votes);

        // Emit question token
        this.emit('questionToken', this.questionToken);
    }

    async create({option, token}: {option: VoteOptions, token: string}) {
        // Input validation
        if(!["A", "B", "C", "D"].find(opt => opt === option)) throw new Error("Invalid voting option");
        if(token === this.questionToken) throw new Error("You already voted!");

        // Actual vote
        this.votes[option] = this.votes[option] + 1;

        // Emit created event
        this.emit('created', this.votes);
    }

    async find() {
        // Just return all our messages
        return this.votes;
    }
}

// This tells TypeScript what services we are registering
type ServiceTypes = {
    votes: VotingService
}

// Creates an KoaJS compatible Feathers application
const app = koa<ServiceTypes>(feathers())

// Use the current folder for static file hosting
app.use(serveStatic('./public'))
// Register the error handle
app.use(errorHandler())
// Parse JSON request bodies
app.use(bodyParser())

// Register REST service handler
app.configure(rest())
// Configure Socket.io real-time APIs
app.configure(socketio())
// Register our messages service
app.use('votes', new VotingService(), {
    methods: ['find', 'create', 'reset', 'getQuestionToken'],
    events: ['created', 'reset', 'questionToken']
})

// Add any new real-time connection to the `everybody` channel
app.on('connection', (connection) => app.channel('everybody').join(connection))
// Publish all events to the `everybody` channel
app.publish((_data) => app.channel('everybody'))

// Start the server
app
    .listen(3030)
    .then(() => console.log('Feathers server listening on localhost:3030'))

// For good measure let's create a message
// So our API doesn't look so empty
// app.service('votes').create({
//     text: 'Hello world from the server'
// })