import { Button, Frog } from 'frog'
import { devtools } from 'frog/dev'
import { serveStatic } from 'frog/serve-static'
// import { neynar } from 'frog/hubs'
import { handle } from 'frog/vercel'

// Uncomment to use Edge Runtime.
// export const config = {
//   runtime: 'edge',
// }

// Define card types and deck
interface Card {
  value: string;
  suit: string;
}
const suits = ['hearts', 'diamonds', 'clubs', 'spades']
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

const createDeck = (): Card[] => {
  return suits.flatMap(suit => 
    values.map(value => ({
      suit,
      value,
      image: `/assets/${value}_of_${suit}.png`
    }))
  )
}

// Game state
type GameState = {
  playerHand: Card[]
  dealerHand: Card[]
  deck: Card[]
  gameOver: boolean
}

const initialState: GameState = {
  playerHand: [],
  dealerHand: [],
  deck: createDeck(),
  gameOver: false
}

// Game logic functions
const drawCard = (deck: Card[]): [Card, Card[]] => {
  const index = Math.floor(Math.random() * deck.length)
  return [deck[index], deck.filter((_, i) => i !== index)]
}

const calculateHandValue = (hand: Card[]): number => {
  let value = 0
  let aces = 0
  for (const card of hand) {
    if (card.value === 'A') {
      aces += 1
    } else if (['K', 'Q', 'J'].includes(card.value)) {
      value += 10
    } else {
      value += parseInt(card.value)
    }
  }
  for (let i = 0; i < aces; i++) {
    if (value + 11 <= 21) {
      value += 11
    } else {
      value += 1
    }
  }
  return value
}

export const app = new Frog({
  assetsPath: '/assets',
  basePath: '/api',
  title: 'WavyJack',
})

app.use('/assets/*', serveStatic({ root: './assets' }))

app.frame('/', (c) => {
  const { buttonValue, deriveState } = c
  
  let state: GameState = initialState;

  deriveState((previousState: unknown) => {
    if (previousState && typeof previousState === 'object' && 'playerHand' in previousState) {
      state = previousState as GameState;
    }

    if (buttonValue === 'start') {
      const newDeck = createDeck()
      const [card1, deck1] = drawCard(newDeck)
      const [card2, deck2] = drawCard(deck1)
      const [dealerCard, finalDeck] = drawCard(deck2)
      state = {
        playerHand: [card1, card2],
        dealerHand: [dealerCard],
        deck: finalDeck,
        gameOver: false
      }
    } else if (buttonValue === 'hit') {
      const [newCard, newDeck] = drawCard(state.deck)
      const newPlayerHand = [...state.playerHand, newCard]
      state = {
        ...state,
        playerHand: newPlayerHand,
        deck: newDeck,
        gameOver: calculateHandValue(newPlayerHand) > 21
      }
    } else if (buttonValue === 'stand') {
      let dealerHand = [...state.dealerHand]
      let deck = [...state.deck]
      while (calculateHandValue(dealerHand) < 17) {
        const [newCard, newDeck] = drawCard(deck)
        dealerHand.push(newCard)
        deck = newDeck
      }
      state = {
        ...state,
        dealerHand,
        deck,
        gameOver: true
      }
    }
  })

  const playerScore = calculateHandValue(state.playerHand)
  const dealerScore = calculateHandValue(state.dealerHand)

  // Use the environment variable for the base URL
  const baseUrl = process.env.BASE_URL || 'http://localhost:5173'; // Fallback for local development
  const backgroundImageUrl = `${baseUrl}/assets/background.png`;

  console.log('BASE_URL:', process.env.BASE_URL);

  return c.res({
    image: (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: `url(${backgroundImageUrl})`, // Use absolute URL here
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: 'white',
        padding: '20px',
        width: '100%',
        height: '100%',
        textAlign: 'center'
      }}>
        <h1 style={{ marginBottom: '20px' }}>WavyJack</h1>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <h2>Your Hand: {playerScore}</h2>
          <div style={{ display: 'flex', flexDirection: 'row', marginBottom: '20px' }}>
            {state.playerHand.map((card: Card, index: number) => (
              <img 
                key={index} 
                src={`${baseUrl}/assets/${card.value.toLowerCase()}_of_${card.suit.toLowerCase()}.png`} 
                alt={`${card.value} of ${card.suit}`} 
                style={{ width: '80px', height: '120px', marginRight: '5px' }} 
                width={80}
                height={120}
              />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <h2>Dealer's Hand: {state.gameOver ? dealerScore : '?'}</h2>
          <div style={{ display: 'flex', flexDirection: 'row', marginBottom: '20px' }}>
            {state.dealerHand.map((card: Card, index: number) => (
              <img 
                key={index} 
                src={index === 0 || state.gameOver 
                  ? `${baseUrl}/assets/${card.value.toLowerCase()}_of_${card.suit.toLowerCase()}.png`
                  : `${baseUrl}/assets/card_back.png`
                } 
                alt="Card" 
                style={{ width: '80px', height: '120px', marginRight: '5px' }} 
                width={80}
                height={120}
              />
            ))}
          </div>
        </div>
        {state.gameOver && (
          <h2 style={{ textAlign: 'center' }}>
            {playerScore > 21 ? 'Bust! You lose!' :
             dealerScore > 21 ? 'Dealer busts! You win!' :
             playerScore > dealerScore ? 'You win!' :
             playerScore < dealerScore ? 'You lose!' :
             'It\'s a tie!'}
          </h2>
        )}
      </div>
    ),
    intents: [
      <Button value="start">New Game</Button>,
      ...(!state.gameOver ? [
        <Button value="hit">Hit</Button>,
        <Button value="stand">Stand</Button>
      ] : [])
    ]
  })
});

// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== 'undefined'
const isProduction = isEdgeFunction || import.meta.env?.MODE !== 'development'
devtools(app, isProduction ? { assetsPath: '/.frog' } : { serveStatic })

export const GET = handle(app)
export const POST = handle(app)
