# Sports Aggregator

A browser app that summarises recent match outcomes across several sports and competitions in one place.

## Language

**Sport**:
A kind of game with its own scoring rules, such as basketball, American football, football or rugby union.
_Avoid_: Category, game type

**Competition**:
A named league or tournament within a Sport whose matches are summarised, such as the NBA or the Premier League. It is the unit added to extend coverage.
_Avoid_: League, tournament, feed

**Result**:
The outcome of one finished match in a Competition: the two teams, their final scores and the match date.
_Avoid_: Score, game, fixture, event

**Match Details**:
An external page with fuller information about the match behind a Result.
_Avoid_: Match report, game page

**Window**:
The N calendar days, ending with and including today, whose Results are summarised. Days follow the viewer's local timezone. N is 1, 3, 7 or 14, defaulting to 3.
_Avoid_: Range, period, last few days
