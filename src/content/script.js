// An Ordinary Cat — every word the game says.
// Owner: WRITER agent. Room agents may ADD keys (marked // ADDED BY <agent>), never rewrite lines.
// Shapes (see docs/ARCHITECTURE.md):
//   [{who,text}, ...]                      dialogue lines
//   'string'                               narrator caption
//   ['a','b',...]                          random-pick caption pool
//   [[{who,text}], [{who,text}], ...]      random-pick pool of line-arrays (idle, wrong reactions)
//   { prompt:[lines], options:[{text, reply:[lines]}, {text, reply:[lines]}] }   choice
// Rules: the cat never uses exclamation marks. Keep lines short.

const c = (text) => ({ who: 'cat', text });
const n = (text) => ({ who: 'narrator', text });
const q = (text) => ({ who: 'quince', text });

export const script = {
  // ─────────────────────────────────────────────── TITLE
  'title.subtitle': 'An escape room. Three rooms. One very ordinary cat.',
  'title.blurb': [
    'A parcel for the wizard Bartholomew Quince. Signature required.',
    'The tower is warm, the rain is steady, and the door is about to close behind you.',
    'There is a cat on the desk. It is, by its own account, entirely ordinary.',
  ],

  // ─────────────────────────────────────────────── ROOM 1 — THE STUDY
  // Prelude note over black after New Game (playtest: nobody knew they were a courier): the delivery docket the
  // courier was handed. Stays until clicked / any key. Then the parcel flies into the bar and the door shuts.
  'prelude.note': {
    firm: 'Pennywhistle & Daughters',
    trade: 'Arcane Deliveries',
    heading: 'Courier instructions',
    ref: 'Docket No. 417',
    rows: [
      ['To', 'Bartholomew Quince'],
      ['At', 'The Tower'],
    ],
    stamp: 'Signature required',
    button: 'Set off',
    hint: 'Click anywhere or press any key',
  },
  'room1.intro': [
    n('The door swings shut behind you. A rune flares across it, blue-white and smug.'),
    n('On the desk sits a cat.'),
    c("Don't mind me. I'm an ordinary cat."),
    c('The wizard is out. Indefinitely. And the door only opens for the master of the tower.'),
    c("Still. If you'd like to leave, there are three small chores. Nothing magical. Just… chores."),
  ],

  'choice.room1.thumbs': {
    prompt: [
      c("I'd do them myself, naturally. Only I'm a cat."),
      c('…Paws.'),
    ],
    options: [
      {
        text: 'Did you ever have thumbs?',
        reply: [
          c('What an extraordinary thing to ask an ordinary cat.'),
          c('…They were very good thumbs. One imagines.'),
        ],
      },
      {
        text: 'Of course. Cats famously lack thumbs.',
        reply: [
          c('Famously. Exactly. You understand perfectly.'),
          c("I like you. Don't let it go to your head."),
        ],
      },
    ],
  },

  // Hints — clock
  'hint.clock.1': [c("That clock has been twelve o'clock for a week. It's very confident about it.")],
  'hint.clock.2': [c("The portrait. He's holding a pocket watch. He always did like to be photographed punctual.")],
  'hint.clock.3': [c('Seven thirty-five. Set the hands to seven thirty-five.'), c("Don't make me say it again.")],

  // Hints — desk
  'hint.desk.1': [c('You have a key. There is a locked thing. I leave the rest to your enormous primate brain.')],
  'hint.desk.2': [c("The desk drawer. It's locked. Brass keys are fond of brass locks, I'm told.")],
  'hint.desk.3': [c('Select the brass key. Use it on the desk drawer.'), c('I could have done it myself, given thumbs.')],

  // Hints — shelf
  'hint.shelf.1': [c('Read the letter. People write letters for a reason. Usually money.')],
  'hint.shelf.2': [
    c('"Stitched into the chair." The cushion on the armchair.'),
    c("The stitching's small. Some of us have eyes for it. You have a magnifying glass."),
  ],
  'hint.shelf.3': [
    c('Push the books green, violet, red, gold. In that order.'),
    c("He used to hum it. Badly. I'm told."),
  ],

  // Hints — grimoire
  'hint.grimoire.1': [c("Four letters. Something he'd never forget. He forgot his own birthday twice, so lower your hopes.")],
  'hint.grimoire.2': [
    c("He'd have set it to something he loved. Not me, obviously."),
    c("Try the previous cat. There's a bowl."),
  ],
  'hint.grimoire.3': [c('B. E. A. N.'), c('Bean. Spell it on the lock. We needn\'t discuss Bean further.')],

  // Hints — room 2
  'hint.valves.1': [c('The cauldron is cold. Cold cauldrons are just very large soup bowls.')],
  'hint.valves.2': [c('The brass pipes on the wall feed the burner. At present they feed the wall.')],
  'hint.valves.3': [
    c('Rotate the pipe pieces until one line runs from the inlet on the left to the outlet on the right.'),
    c('Left to right. Like reading. Like a civilised person.'),
  ],

  'hint.recipe.1': [c("There's a recipe on the chalkboard. Wizards are only cooks with worse handwriting.")],
  'hint.recipe.2': [
    c('Each line is a riddle about a jar on the shelf. Read the labels.'),
    c('What never shuts its eyes? Not me. I nap professionally.'),
  ],
  'hint.recipe.3': [
    c('Fish scales: fish never close their eyes. Powdered moonlight. Dawn salt.'),
    c("The salt's in the glass case. Of course it is."),
  ],

  'hint.scale.1': [c("The glass case won't open while its lid is crooked. He was particular about level surfaces.")],
  'hint.scale.2': [
    c("The owl weighs seven. There are four loose weights hidden about. Bench, drawer, sill, chalkboard tray."),
  ],
  'hint.scale.3': [c('Put the one, the two and the four on the right pan. That makes seven.'), c('Leave the eight. The eight is a show-off.')],

  'hint.cauldron.1': [c('You have ingredients and a pot. This is the bit that is traditionally called cooking.')],
  'hint.cauldron.2': [c('Add them in the order on the chalkboard. One, two, three. Then stir.')],
  'hint.cauldron.3': [
    c('Fish scales, then moonlight, then dawn salt. Then click the paddle to stir.'),
    c('If it goes the colour of a bruise at dusk, stop congratulating yourself and take the bottle.'),
  ],

  // Hints — room 3
  'hint.telescope.1': [c("There's a telescope. I'm sitting on it. You might consider looking through it.")],
  'hint.telescope.2': [c('The star chart has one constellation circled. Find it in the eyepiece.')],
  'hint.telescope.3': [
    c('Look through the telescope and centre Felis, the Cat. It looks like a cat. Remarkably.'),
    c('Then the moon sits under it. As is proper.'),
  ],

  'hint.orrery.1': [c('"The Wanderers stand so." Wanderers are planets. Planets are on that table.')],
  'hint.orrery.2': [c('The star chart shows where each planet goes. So does the telescope, for the thorough.')],
  'hint.orrery.3': [
    c("Inner planet at twelve o'clock. Middle at three. Outer at nine."),
    c('Click each one round until it gets there. Ratchety, I know.'),
  ],

  'hint.rite.1': [c("Five candles, one lectern, one bottle of something purple. It's practically assembling itself.")],
  'hint.rite.2': [
    c('Put the incantation page on the lectern and pour the elixir in the centre bowl.'),
    c('Then read the page. The compass rose tells you which candle is which.'),
  ],
  'hint.rite.3': [
    c('East, then West, then North. Then South-West, nearest the lectern. Then South-East.'),
    c('Light them in that order. Try not to set your sleeve on fire. Again.'),
  ],

  'hint.lure.1': [c("The subject stands in the circle. And there's no one here but you and an ordinary cat.")],
  'hint.lure.2': [c("An ordinary cat would never be bribed into a circle. Not by anything you've been carrying since the study.")],
  'hint.lure.3': [c('Use the sardines.'), c('…On the circle. Obviously. I am merely making conversation.')],
  // Lure hints when the player is NOT carrying the sardines (room3.hintVariant). ADDED BY loose-ends pass.
  //   nodesk: study drawer still locked, key in pocket   nokey: drawer locked, no key   notin: drawer open, tin left in it
  'hint.lure.nodesk.1': [
    c("The subject stands in the circle. And there's no one here but you and an ordinary cat."),
    c("An ordinary cat who would need a very good reason. You don't appear to be carrying one."),
  ],
  'hint.lure.nodesk.2': [
    c('There was a tin in the study. In the desk drawer. The locked one.'),
    c("You have the key. You've had it for some time."),
  ],
  'hint.lure.nodesk.3': [
    c('Go back to the study. Use the brass key on the desk drawer. Bring the sardines.'),
    c('I will be here. Being ordinary. Not hungry.'),
  ],
  'hint.lure.nokey.1': [
    c("The subject stands in the circle. And there's no one here but you and an ordinary cat."),
    c("An ordinary cat who would need a very good reason. You don't appear to be carrying one."),
  ],
  'hint.lure.nokey.2': [
    c("There was a tin in the study desk. Locked drawer. The key is in the clock, I'm told."),
    c('The portrait knows the time. He always was punctual.'),
  ],
  'hint.lure.nokey.3': [
    c('Go back to the study. Set the clock to seven thirty-five. Take the key. Open the desk drawer.'),
    c("Bring the sardines. Then we'll talk. Briefly."),
  ],
  'hint.lure.notin.1': [
    c("The subject stands in the circle. And there's no one here but you and an ordinary cat."),
    c("An ordinary cat who would need a very good reason. You don't appear to be carrying one."),
  ],
  'hint.lure.notin.2': [
    c('There was a tin in the study desk drawer. You opened the drawer and left the tin.'),
    c('I noticed. Cats notice.'),
  ],
  'hint.lure.notin.3': [
    c('Go back to the study. The sardines are still in the desk drawer. Bring them.'),
    c('…On the circle, when you have them. Obviously.'),
  ],

  // Idle — escalating slips
  'idle.room1': [
    [c("I'm a cat. I do cat things. Sitting. Judging. The occasional tax return.")],
    [c("That armchair is mine. Was mine. Is the wizard's. I sit in it. As a cat.")],
    [c("Don't touch the globe too much. He hates fingerprints on Patagonia.")],
    [c('If you see a pair of reading glasses, they are not mine. Cats are long-sighted.'), c('I think.')],
    [n('The cat washes a paw, then stares at it as if it owes him money.')],
    [c("Purring, as you'll note. A thing ordinary cats do."), c('…Rrr.')],
    [c("I'm not watching you. I'm watching the space you're standing in. Different thing.")],
  ],
  'idle.room2': [
    [c("I've never been in this room before. Mind the third jar, it bites.")],
    [c('The wizard keeps his lab spotless. I keep his lab spotless. He keeps— it is kept.')],
    [n("The cat nudges a vial to the shelf's edge. It doesn't fall. He looks let down.")],
    [c("I'm told I once brewed a potion of perfect sleep. I'm told I drank it. A whole Tuesday."), c('…He. He drank it.')],
    [c("Ordinary cats love laboratories. The smells. The fire. The crushing sense of one's own mistakes.")],
    [c('If you find a hat in here, pointed, slightly crushed, it was crushed before. Not by a cat sleeping in it.')],
    [c('You have very nice hands. Five fingers each. Nobody appreciates that until it stops.')],
  ],
  'idle.room3': [
    [c('I named half these stars. As a hobby. Cats have hobbies.')],
    [c("When I'm— when he's back, there will be a very stern letter to the Guild about all this.")],
    [n('The cat shifts. The telescope drifts two degrees toward Gerald.')],
    [c('Fine. Hypothetically. If a wizard turned himself into a cat. Purely as an exercise.'), c("He'd still be a very ordinary cat. That's my point.")],
    [c("I don't miss thumbs. I don't miss anything. Least of all buttons.")],
    [c("I signed my name in the stars once. Lower left. Don't look, it's private.")],
    [c("I am an ordinary cat, I'm an ordinary cat, I'm— you get the idea."), c("I'm practising. For no reason.")],
  ],

  // Puzzle reactions — room 1
  'react.clock.solved': [c('Seven thirty-five. Breakfast. He never missed it. I hear.')],
  'react.clock.wrong': [
    [c('That is a time. Not the time, but a time.')],
    [c("Clocks are not dartboards. Though you're welcome to keep throwing.")],
    [c("Wrong again. Not that I'm counting. Cats can't count. We only get as far as dinner.")],
  ],
  'react.desk.solved': [c('It sticks. You have to lift and— I imagine.'), c("Cats don't use drawers.")],
  'react.drawer.open': [c('It sticks. You have to lift and— I imagine.'), c("Cats don't use drawers.")],
  'react.shelf.solved': [c("Hidden bookcase. How dramatic. He's a very dramatic man."), c('Handsome, too. One hears.')],
  'react.shelf.wrong': [
    [c('Not that one. Unless you enjoy the thunk.')],
    [c("Wrong book. You're treating this as a lucky dip. The shelf would like you to know it isn't.")],
    [c('Every time you get it wrong, a librarian somewhere sighs.')],
  ],
  'react.grimoire.solved': [c('Bean.'), c('…Yes. Well. Bean was a good cat. Terrible at magic. Moving on.')],
  'react.grimoire.wrong': [
    [c("No. He'd never use that. Unless he was very tired.")],
    [c("Four letters. That's not it. I've no idea what it is, naturally. But it isn't that.")],
    [c("It's not his name. Too obvious. Even he knew that.")],
  ],
  'react.labdoor.open': [c('Oh good. The laboratory.'), c("Try not to touch anything that's humming.")],
  'react.frontdoor.zap': [c('Yes. It does that.')],

  // Puzzle reactions — room 2
  'react.valves.solved': [c("Gas. In a wizard's tower."), c("He's a modern man.")],
  'react.recipe.solved': [c("Fish, moon, dawn. You can read. I'd suspected, but it's nice to have it confirmed.")],
  'react.scale.solved': [c('Seven. He always said seven was the only honest number.'), c('He said a lot of things.')],
  'react.scale.wrong': [
    [c('The owl remains unimpressed. So do I.')],
    [c("The owl can tell. The owl can always tell. It's why nobody likes the owl.")],
    [c("Too much. If you're going to use the eight, I'll need to lie down.")],
  ],
  'react.cauldron.solved': [c('Up the stairs.'), c('Mind the eleventh step. It is… decorative.')],
  'react.cauldron.wrong': [
    [c('That was the colour of a mistake at dusk.')],
    [c("Order matters. It's a recipe, not a salad.")],
    [c('Your eyebrows are fine. Mostly.')],
    [c("Remarkable. You've made something that smells like regret and tastes, I'd wager, of newt.")],
  ],
  'react.stairs.open': [c("The observatory. Lovely view. Not that I'd know. I've never been up there.")],

  // Puzzle reactions — room 3
  'react.telescope.solved': [c('Felis, the Cat. A flattering likeness.'), c('Of cats generally. Not of anyone in particular.')],
  'react.orrery.solved': [c("There. The heavens agree with him. That doesn't happen often.")],
  'react.rite.solved': [c('Five for five. The circle is ready.'), c("Shame there's no one to put in it.")],
  'react.rite.wrong': [
    [c('And they all go out. The candles have opinions about order.')],
    [c("They all went out at once. That isn't sulking. That's a verdict.")],
    [c('Five candles, five opinions, and all of them currently about you.')],
  ],
  'react.lure.solved': [c('Mm.'), c('…Mm.')],
  'react.lure.beat1': [c('This is beneath me.')],
  'react.lure.beat2': [c('…Is that oil-packed?')],

  // Item interactions
  'react.parcel.open': [c('The seal is warded.'), c('Also, it would be rude.')],
  'react.parcel.cat': [c("Not now. I'm working."), c('…Leave it on the desk.')],
  'react.key.cat': [c('That is a key. I am a cat.'), c('It opens the desk drawer. In the study. Try the drawer.')], // ADDED BY loose-ends pass (rooms 2–3)
  // Loose ends — said once by the cat in rooms 2 and 3 when something the ending needs was left in the study
  // (Room.looseEnd → Hints). key: brass key still carried. desk: drawer locked, no key. tin: drawer open, tin left.
  'react.loose.key.room2': [
    c("You're still carrying that key. It jingles."),
    c("It opens the desk drawer. In the study. I'm told. Cats don't use drawers."),
  ],
  'react.loose.key.room3': [
    c('That brass key. Still in your pocket. Still not in the study desk.'),
    c('I only mention it because the last chore has a very specific appetite.'),
  ],
  'react.loose.desk.room2': [
    c("There's a desk in the study with a drawer you never opened."),
    c('The clock would know where the key is. Clocks are like that.'),
  ],
  'react.loose.desk.room3': [
    c('The study desk. Locked drawer. You never did get into it.'),
    c('Set the clock to what the portrait says and it will cough up a key. Allegedly.'),
  ],
  'react.loose.tin.room2': [
    c('You opened the desk and left the tin in it.'),
    c("I'm not saying that was a mistake. I'm an ordinary cat. I don't have opinions about tins."),
  ],
  'react.loose.tin.room3': [
    c('The tin. In the study desk. You left it there.'),
    c("Not that I've been thinking about it. Constantly."),
  ],
  'react.sardines.cat': [
    [c('Not now.'), c('…Is that oil-packed? Not now.')],
    [c("I said not now. I'm an ordinary cat with ordinary self-control."), c('Put it away before I lose it.')],
  ],
  'react.sardines.early': [
    n("Nothing to do with it here. The cat is watching the tin very closely."),
  ],
  'react.cat.pet': [
    [c('Rrr. Yes. Fine. That will do.')],
    [c("I'm thinking. Ordinary cats think. Ask me again in a minute.")],
    [n('The cat closes his eyes slowly. It is either affection or a dismissal.')],
    [c('Behind the ears. No— left. Your left. …Adequate.')],
  ],

  'choice.room2.wizard': {
    prompt: [
      c("He keeps a tidy lab, the wizard. When he's here. Which he isn't."),
    ],
    options: [
      {
        text: 'So where IS the wizard?',
        reply: [
          c('Out. A long way out.'),
          c('Possibly quite close, in a sense. It is hard to say. Next question.'),
        ],
      },
      {
        text: 'He sounds very organised.',
        reply: [
          c('He is. Was. Is. Extraordinarily organised.'),
          c('Tall, as well. Good cheekbones. I gather.'),
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────── ROOM 2 — THE LABORATORY
  'room2.intro': [
    n('Glass, brass and a faint smell of singed eyebrow. Something is humming.'),
    c("Oh, you're here. I was always here. On this shelf. You simply weren't looking."),
    c("Chore two. There's a recipe. An ordinary recipe for an ordinary cat to watch you make."),
  ],

  // ─────────────────────────────────────────────── ROOM 3 — THE OBSERVATORY
  'room3.intro': [
    n('Cold air. Stars through the dome. A circle on the floor, waiting.'),
    c('The observatory. Where I have obviously been sitting all along.'),
    c("Last chore. Line up the heavens, light some candles. Very ordinary. Cats do it all the time."),
  ],

  'choice.room3.confront': {
    prompt: [c("Well. That's everything. The circle's ready."), c('Pity it needs someone to stand in it.')],
    options: [
      {
        text: "You're him, aren't you.",
        reply: [
          c('I am a cat. I have whiskers. I lick things.'),
          c('…Is there something in your bag that smells of fish?'),
        ],
      },
      {
        text: "You're a very ordinary cat.",
        reply: [
          c('Thank you. Finally, someone who listens.'),
          c("I'd still accept a bribe. In principle. Hypothetically. Oil-packed."),
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────── ENDING
  'ending.transform': [
    n('The light folds in. Where the cat was, a tall man in a grey robe blinks.'),
    q('…Ah.'),
    q('Hands. Hello, hands.'),
    n('The tail has stayed. It swishes, guiltily.'),
    q("We'll call it a draft."),
  ],
  'ending.door': [
    q('Right. Your door.'),
    n('He touches the rune. It sighs and goes out.'),
    q('It only opens for the master of the tower. Which I have been. Continuously. Throughout.'),
  ],
  'ending.parcel': [
    q("You'll be wanting a signature."),
    n('He signs with a flourish. The warded seal opens for him like a cat door.'),
    n('Inside: Transfiguration Reversal for the Terminally Confident.'),
    q('Ah. That arrived. I ordered it a week ago.'),
    q('Well. Good to have a spare.'),
  ],
  'ending.last': [
    q('Thank you, courier. If anyone asks, you met an ordinary wizard and his ordinary cat.'),
    q('…Do leave the sardines.'),
  ],
  'credits.lines': [
    'AN ORDINARY CAT',
    'You escaped in {time}.',
    'Parcel delivered. Signature obtained.',
    '',
    'Written, built and mostly caused by',
    'a small and very determined team',
    '',
    'The Cat — Bartholomew Quince',
    'Bartholomew Quince — The Cat',
    'Bean — in loving memory (alive, fine, lives with his sister)',
    'Gerald — as himself',
    '',
    'No cats were transfigured in the making of this game.',
    'One wizard was. He would prefer not to discuss it.',
    'The ghost in the jar was paid in sighs.',
    'The eleventh step remains decorative.',
    '',
    'Pennywhistle & Daughters Arcane Deliveries thanks you for your service.',
    'Please rate your courier. (You cannot. There is no form.)',
    '',
    'Thank you for playing.',
    'You spent {time} with a very ordinary cat.',
    'He enjoyed it. He will deny this.',
  ],

  // ─────────────────────────────────────────────── CAPTIONS — ROOM 1
  'caption.globe': 'It spins. You feel you have accomplished something.',
  'caption.books': [
    'Transfiguration for the Terminally Confident.',
    '101 Uses for a Dead Newt.',
    "So You've Been Turned Into Something.",
    'Thumbs: A Retrospective.',
    'Feline Law, Vol. IX.',
    'Wands and Where to Put Them Down.',
    'Know Your Rights: A Familiar\'s Handbook.',
    'Hexes for the Mildly Annoyed.',
    'The Hairball and the Cosmos.',
    'Advanced Napping, 4th ed. Heavily annotated.',
    'Correspondence I Have Not Answered, Vol. II.',
    'Is It Still Magic If It Goes Wrong?',
  ],
  'caption.fire': 'The fire flares. The cat flinches, then pretends he meant to.',
  'caption.quill': 'The quill falls off the desk. It seems to have wanted to.',
  'caption.bowl': 'A cat bowl, engraved BEAN. Far too big for the current cat.',
  // Optional cat follow-up when the bowl is clicked (DESIGN §5 delight).
  'react.bowl': [c('BEAN. His previous familiar. Enormous. Terrible at magic.'), c("We don't talk about Bean.")],
  'caption.portrait': 'A tall wizard with amber eyes, holding a watch. The eyes follow you.',
  'caption.window': 'Rain, moonlight, and a long way down.',
  'caption.rug': 'A good rug. Several patches of it are suspiciously cat-shaped.',
  'caption.cushion.plain': 'An embroidered cushion. The pattern is fussy, and very small.',
  'caption.cushion.magnified': 'Tiny stitched book spines: green, violet, red, gold.',
  'caption.clock.stopped': 'Stopped at twelve. It looks as though it has given up.',
  'caption.clock.running': 'Tick. Tock. The clock seems pleased with itself.',
  'caption.parcel': 'B. QUINCE — THE TOWER — HANDLE WITH THUMBS.',

  // ─────────────────────────────────────────────── CAPTIONS — ROOM 2
  'caption.vials': [
    'A bright little note. The vial seems proud.',
    'Ting.',
    'A vial of something blue and mildly smug.',
    'A low note. Somewhere, a cello is jealous.',
    'This one hums back.',
    'You could play a tune. You could also not.',
  ],
  'caption.jar.newt': 'Newt Eyes (assorted). They are not all looking at you. Most are.',
  'caption.jar.thunder': 'Ground Thunder. The jar rumbles faintly when tilted.',
  'caption.jar.frog': 'Frog Opinions. Mostly about rain.',
  'caption.jar.sighs': 'Bottled Sighs. The cork is straining.',
  // Optional cat comments on the four wrong jars (DESIGN: "the cat comments on each").
  'react.jar.newt': [c('Not today, thank you. They watch you while you sleep.')],
  'react.jar.thunder': [c('Ground thunder. Shake it and it sulks for an hour.')],
  'react.jar.frog': [c("Don't. They'll only tell you it's going to rain. It's always going to rain.")],
  'react.jar.sighs': [c("His. From tax season. Leave them be.")],
  'react.jar.donotopen': [c("It says do not open. I'd respect that. Some of us respect labels.")],
  'caption.jar.donotopen': 'The label says DO NOT OPEN. In three hands. One of them is a paw.',
  'caption.ghost': 'A tiny ghost rises, sighs, and goes back in. Fair enough.',
  'caption.burner.cold': 'The burner is cold. The gas, apparently, is elsewhere.',
  'caption.chalkboard': 'A recipe, half erased. Somebody has drawn a fish in the margin.',
  'caption.case.locked': 'A glass case. Locked. The scale on the lid is crooked.',
  'caption.stairs.blocked': 'A rune across the gate. It hums at you, not kindly.',
  'caption.step11': 'The eleventh step is missing. Decoratively.',
  'caption.weight.found': [
    'A brass weight. Small, dense, faintly smug.',
    'A weight, stamped with a number. Somebody hid it here.',
    'Another weight. The tower is full of loose change.',
    'A brass weight. It pulls your pocket down a little.',
  ],

  // ─────────────────────────────────────────────── CAPTIONS — ROOM 3
  'caption.dome': 'The dome is open to the stars. The stars are open to suggestion.',
  'caption.shootingstar': 'A shooting star. You make a wish. It is mostly about leaving.',
  'caption.moon.wink': 'The moon winks at you. You decide not to mention it.',
  'caption.constellation.other': [
    'The Lesser Spoon.',
    'Gerald.',
    'The Disappointed Heron.',
    'The Teapot That Was Promised.',
    'A Hat, Probably.',
    'The Greater Spoon. Smaller than the Lesser one.',
    'The Accountant.',
  ],
  'caption.candle.unlit': 'An unlit candle. It waits for the words. The lectern lies open, and empty.',
  'caption.candle.dry': 'An unlit candle. The elixir first. The bowl at the heart of the rose is dry.',
  'caption.lectern.closed': 'A lectern, its cover shut. It wants the heavens in order first.',
  'caption.circle.unready': 'A ritual circle. Dark, for now. It is waiting for something.',

  // ADDED BY room3 agent — extra room 3 lines (DESIGN §5 R3-P4 beat + captions for the props)
  'react.lure.subject': [c('The subject stands in the circle.'), c('Which — being an ordinary cat — I obviously am not. Shame.')], // ADDED BY room3 agent
  'caption.scope.drag': 'Stars, more than you can count. Drag to sweep the sky.', // ADDED BY room3 agent
  'caption.orrery.look': 'A brass orrery. Each planet clicks round its ring when nudged.', // ADDED BY room3 agent
  'caption.orrery.help': 'Click: forward · right-click: back.', // ADDED BY final agent
  'caption.lectern.open': 'The lectern lies open. It is waiting for a page.', // ADDED BY room3 agent
  'caption.bowl.empty': 'A little brass bowl at the heart of the compass rose. Dry.', // ADDED BY room3 agent
  'caption.bowl.full': 'The elixir glows in the bowl, bruise-purple and faintly smug.', // ADDED BY room3 agent
  'caption.circle.waiting': 'The inlay glows. The candles stand unlit, waiting for their words.', // ADDED BY room3 agent
  'caption.circle.ready': 'The circle hums. All it lacks is a subject.', // ADDED BY room3 agent
  'caption.candle.lit': 'Lit. It flickers, pleased with itself.', // ADDED BY room3 agent
  'caption.r3.shelves': 'Astrolabes, a sextant, rolled charts. Everything for the sky except a ladder.', // ADDED BY room3 agent
  'caption.r3.astrolabe': 'An astrolabe. It tells the time by the stars. The stars decline to comment.', // ADDED BY room3 agent
  'caption.r3.sextant': 'A sextant. For finding where you are. You are in a tower. With a cat.', // ADDED BY room3 agent
  'caption.r3.globe': 'A celestial globe. It turns. The heavens, for once, do as they are told.', // ADDED BY room3 agent

  // ─────────────────────────────────────────────── ROOM 1 extras — ADDED BY room1 agent
  'early.room1': [c("Look around first. Drag to turn your head. I'll be here, being ordinary.")], // ADDED BY room1 agent
  'toast.nudge.cat': 'Stuck? The cat knows more than he lets on.', // ADDED BY polish agent (one-time HUD nudge, Hints.js)
  'early.room2': [c("You've only just walked in. Have a look round first."), c("Touch nothing that hums. I'll be up here, not knocking things over.")], // ADDED BY polish agent
  'early.room3': [c('Take in the view first. It is very good, I am told.'), c('By whom? By no one. By the view.')], // ADDED BY polish agent
  'caption.r1.drawer.locked': 'Locked. A small brass keyhole, and a cat watching you try it.', // ADDED BY room1 agent
  'caption.r1.key': 'Behind the little door: a brass key. Of course there was.', // ADDED BY room1 agent
  'caption.r1.magnifier': 'A magnifying glass. For small print, and smaller stitching.', // ADDED BY room1 agent
  'caption.r1.sardines': "A tin of sardines, in a wizard's desk. You decide not to ask. Yet.", // ADDED BY room1 agent
  'caption.r1.papers': [ // ADDED BY room1 agent
    'Unpaid invoices, mostly. One is from a man who sells newts.',
    'A half-finished letter: "Dear Guild, I am unable to attend as I am currently—". It stops there.',
    'A shopping list: candles, chalk, newts, sardines (oil-packed, NOT brine).',
  ],
  'caption.r1.ink': 'Ink, still wet. Someone was writing recently. Someone with very small handwriting, or paws.', // ADDED BY room1 agent
  'caption.r1.labdoor.sealed': 'A heavy door, banded in iron. The rune on it hums, unimpressed.', // ADDED BY room1 agent
  'caption.r1.watch': 'The painted pocket watch reads seven thirty-five. It always will.', // ADDED BY room1 agent
  'caption.r1.sampler': 'BLESS THIS TOWER, in cross-stitch. Signed "B.Q. & B." The cat in it is very round.', // ADDED BY room1 agent
  'caption.r1.candles': 'Good beeswax. They have burned for a week and are no shorter.', // ADDED BY room1 agent
  'caption.r1.skull': 'A skull, wearing a candle like a hat. It seems content.', // ADDED BY room1 agent
  'caption.r1.potion': 'Draught of Perfect Sleep. Half empty. Somebody lost a whole Tuesday to this.', // ADDED BY room1 agent
  'caption.r1.hourglass': 'The sand has stopped halfway. Like the clock. Like the wizard.', // ADDED BY room1 agent
  'caption.r1.hat': 'A pointed hat, slightly crushed. There is a cat-shaped dent in the brim.', // ADDED BY room1 agent
  'caption.r1.armchair': 'A deep armchair, moulded to the shape of someone large. Or someone small who sprawls.', // ADDED BY room1 agent
  'caption.r1.shelf': 'Six of these books stick out a little further than the rest.', // ADDED BY room1 agent
  'caption.r1.grimoire.locked': 'A grimoire, chained shut. The lock wants four letters.', // ADDED BY room1 agent
  'caption.r1.alcove': 'A hidden alcove. It smells of old paper and older secrets.', // ADDED BY room1 agent
  'caption.r1.diary.empty': 'The stand is bare now, apart from a faint outline in the dust.', // ADDED BY room1 agent

  // ─────────────────────────────────────────────── GENERIC
  'caption.nope': [
    "That doesn't go there.",
    'Nothing happens. Nothing was ever going to.',
    'You try it. The universe declines.',
    "No. Though you admire your own optimism.",
    'That is not how anything works.',
    'You reconsider. Wisely.',
    'Neither object is impressed by the other.',
  ],
};

export default script;
