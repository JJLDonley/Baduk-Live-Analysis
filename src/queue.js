class Queue {
    constructor() {
        this.queue = [];
        this.processing = false;
    }

    async process(game, uuid, queries, moves, ai, BES) {
        this.queue.push({ game, uuid, queries, moves, ai, BES });
        if (!this.processing) this.processNext();
    }

    async processNext() {
        if (this.queue.length === 0) {
            this.processing = false;
            return;
        }
    
        this.processing = true;
        const { game, uuid, queries, moves, ai, BES } = this.queue.shift();
        try {
            const query = await ai.query(uuid, queries, moves)
            await game.analysis(query, moves);
            
            const gameEmitID = `${game.type}/${game.id}`

            const payload = {
                type: gameEmitID,
                data: game.data(),
            };
            console.log('Emitted: ' + game.data())
            BES.emit(gameEmitID, JSON.stringify(payload));
            
        } catch (error) {
            console.error('Error processing query:', error);
        }
    
        await this.processNext(); // Use 'await' here
    }
    
}


module.exports = Queue