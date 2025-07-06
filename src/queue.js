class Queue {
	constructor() {
		this.queue = [];
		this.processing = false;
	}

	async process(game, uuid, queries, moves, ai, BES) {
		this.queue.push({ game, uuid, queries, moves, ai, BES });
		if (!this.processing) {
			this.processNext();
		}
	}

	async processNext() {
		if (this.queue.length === 0) {
			this.processing = false;
			return;
		}

		this.processing = true;
		const { game, uuid, queries, moves, ai, BES } = this.latestUniqueMove();

		try {
			const query = await ai.query(uuid, queries, moves);
			const analysisResult = await game.analysis(query, moves);

			const gameEmitID = `${game.type}/${game.id}`;
			const payload = {
				type: gameEmitID,
				data: game.data(),
				// Include analysis metadata at the top level
				analysisId: analysisResult.id,
				gameType: analysisResult.type,
				gameId: analysisResult.gameId,
				moveNumber: analysisResult.moveNumber,
				timestamp: analysisResult.timestamp
			};
			
			BES.emit(gameEmitID, JSON.stringify(payload));
		} catch (error) {
			console.error(`Error processing query for Game::${game.id}:`, error);
		}

		await this.processNext();
	}

	latestUniqueMove() {
		if (this.queue.length === 0) {
			return null;
		}

		let latestMove = this.queue.shift();
		let i = 0;

		while (i < this.queue.length) {
			if (this.queue[i].uuid === latestMove.uuid) {
				latestMove = this.queue.splice(i, 1)[0];
			} else {
				i++;
			}
		}

		return latestMove;
	}
}

module.exports = Queue;
