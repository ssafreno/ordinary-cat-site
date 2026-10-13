// Readable documents. Owner: WRITER agent.
// Shape: { title, body (\n for line breaks), style: 'letter'|'diary'|'page'|'chalk' }

export const papers = {
  letter_guild: {
    title: 'A letter from the Guild of Thaumaturges',
    style: 'letter',
    body:
      'To Bartholomew Quince, Esq., The Tower.\n\n' +
      'Dear Bartholomew,\n\n' +
      'This is the fourth notice regarding your Guild dues, which remain outstanding ' +
      'since the spring equinox of the year before last.\n\n' +
      'The Committee notes that "I was busy being a heron" is not, as you claim, a recognised exemption.\n\n' +
      'Kindly remit at your earliest convenience, or at any convenience at all.\n\n' +
      'Yours, with diminishing patience,\n' +
      'M.\n' +
      'Secretary, Guild of Thaumaturges\n\n' +
      'P.S. Bartholomew — you asked me to remind you, since you always forget: ' +
      'your shelf is read in the order the dawn arrives. ' +
      'You stitched it into the chair, you absolute fool. —M.',
  },

  diary_page: {
    title: 'A page torn from a diary',
    style: 'diary',
    body:
      'Tuesday.\n\n' +
      'Set the lock to the one word I\'d never forget.\n' +
      'Not my name. Too obvious.\n\n' +
      '— B.Q.',
  },

  chalkboard: {
    title: 'The chalkboard',
    style: 'chalk',
    body:
      'ELIXIR OF REVERSION\n\n' +
      'i.   A scale from the one that never shuts its eyes\n' +
      'ii.  Three drops of what the moon left on the sill\n' +
      'iii. A pinch of what the dawn is made of\n\n' +
      'Stir until the colour of a bruise at dusk.',
  },

  page_incantation: {
    title: 'The Rite of Reversion',
    style: 'page',
    body:
      'Fill the bowl at the heart of the rose,\n' +
      'then light the five as the Rite demands:\n' +
      'first the flame that greets the dawn,\n' +
      'then its shadow, straight across;\n' +
      'then the one the north wind touches,\n' +
      'then the two that still remain —\n' +
      'the lectern\'s neighbour first, then the last.\n\n' +
      'Let the subject stand within the circle.',
  },

  star_chart_note: {
    title: 'A note on the star chart',
    style: 'page',
    body:
      'When the Cat sits upon the Moon,\n' +
      'and the Wanderers stand so:\n\n' +
      'Inner — twelve o\'clock.\n' +
      'Middle — three o\'clock.\n' +
      'Outer — nine o\'clock.\n\n' +
      '(Felis is circled. Twice. In a different ink, someone has added: "obviously.")',
  },

  parcel_label: {
    title: 'The parcel label',
    style: 'page',
    body:
      'PENNYWHISTLE & DAUGHTERS ARCANE DELIVERIES\n\n' +
      'TO: B. QUINCE — THE TOWER\n' +
      'HANDLE WITH THUMBS\n\n' +
      'Signature required. Do not leave with familiar.',
  },
};

export default papers;
