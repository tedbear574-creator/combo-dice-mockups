# Combo Dice mockups

Playable HTML mockups for Combo Dice, a Roblox game. Each file runs on its own in a browser.

- `verb/`: one board, four ways your character plays it: Watch (it rolls itself), Stomp, Throw, Carry (`watch.html` ... `carry.html`, code in `play.js`)
- `verb/workshop.html`: the dice workshop. Carry dice between a press (blank dice), a stamp (sets a face to its number; the pad beside it turns the number), a kiln (stone, iron, gold, glass, lava) and a melter, while the board rolls itself; a plaza machine drops dice for you and two other players, rare ones announced. Rules in `workshop-rules.js`, economy sim `node verb/workshop-sim.js [seed] [idle,fill,sixes]`, page in `workshop.js`
- `tycoon-v3.html`: the idle workshop plot with the whole board open, dice bought and merged, rarity shown by frames
- `tycoon-v2.html`: the idle workshop plot with board cells bought one at a time (the version in Roblox)
- `tycoon-v1.html`: the idle workshop plot as the original web game played (frozen)
- `adventure-ui.html`: the Adventure mode screens

Live at https://tedbear574-creator.github.io/combo-dice-mockups/
