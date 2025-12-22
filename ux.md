Popqiz --- UX Outline (v1)
========================

Product Summary
---------------

**Popqiz** is a zero-setup, real-time trivia game for short, social moments (waiting for food, killing time, casual hangs). Players join on their own phones and play together instantly.

**Core promise:**

> *"We can start playing right now."*

* * * * *

Product Principles
------------------

-   Starts in under 3 seconds

-   No accounts, no logins

-   Mobile-first, thumb-friendly

-   One primary action per screen

-   No scrolling during gameplay

-   Feels like a game, not a webpage

-   Designed for mixed ages and short sessions (5--15 minutes)

* * * * *

Global UX Rules
---------------

-   Large tap targets

-   Minimal text

-   One-hand playable

-   Fast, playful transitions (no page-load feel)

-   Bright but refined color usage

-   All players use their own phones

-   The game never stops to ask for feedback

-   **Mobile-first design**: No hover states (mobile web app) - all interactions use active/tap states only

* * * * *

Mobile Interaction Patterns
----------------------------

-   **No hover states**: This is a mobile web app, so all interactive elements use tap/active states only

-   **Touch-friendly feedback**: Buttons use `active:scale-[0.98]` for visual feedback on tap

-   **Subtle UI elements**: Secondary actions (like "Something looks off") use reduced opacity (40%) to maintain subtlety without relying on hover

* * * * *

Visual Direction (Modern + Fun)
-------------------------------

### Overall Vibe

-   Playful, modern, friendly

-   Designed, not arcade-y

-   Bright without being loud

-   Clean enough to feel good opening in public

### Base Canvas

-   **Background:** `#00486D` (dark blue)

-   **Surface / cards:** `#FFFFFF`

-   **Primary text:** `#FFFFFF` (white for dark background)

-   **Primary text (dark):** `#1F2937` (charcoal for light surfaces)

-   **Secondary text:** `#E0E0E0` (light gray for dark background)

-   **Secondary text (dark):** `#6B7280` (medium gray for light surfaces)

* * * * *

Brand & Action Color
--------------------

Used for primary CTAs and focus states.

-   **Brand (Primary):** `#FCB107` (gold/yellow)

-   **Secondary:** `#02ACC2` (teal/cyan)

-   **Tertiary:** `#E50846` (red/pink)

* * * * *

Team Colors (Refined, Not Primary)
----------------------------------

These replace harsh red/blue/green.

-   **Yellow:** `#FDBA2D`

-   **Teal:** `#2EC4D6`

-   **Red:** `#E63946`

-   **Orange:** `#F77F00`

-   **Light Blue:** `#7ED6DF`

-   **Pink:** `#FF85C0`

-   **Lime:** `#B6E600`

-   **White:** `#FFFFFF`

Rules:

-   One team = one color

-   Colors are randomly assigned to teams (ensuring no duplicates in a room)

-   Used consistently across answers, leaderboard, and confetti

-   Never mix meanings per screen

Team Names
----------

-   Pool of 100 unique, fun team names (e.g., "Team Thunderbolts", "Team Fireflies", "Team Dolphins")

-   Randomly assigned to players when joining or starting a game

-   Ensures no duplicate team names within a room

-   If all 100 names are used in a room, numbered variants are created (e.g., "Team Thunderbolts 2")

* * * * *

Feedback & Status Colors
------------------------

-   **Correct / success:** `#22C55E` (green)

-   **Skip / neutral:** `#9CA3AF` (gray)

-   **Warning / inappropriate:** `#F97316` (orange)

Avoid pure red for errors.

* * * * *

Confetti
--------

-   Uses only team colors

-   Short duration (1--1.5s)

-   Shown only on leaderboard screens

* * * * *

Typography
----------

-   Large, friendly sans-serif

-   Rounded feel preferred

-   Hierarchy via size and weight, not color

* * * * *

1\. Landing Page (`/`)
----------------------

### Purpose

Get users into a game immediately.

### UI

-   Logo / wordmark: **Popqiz**

-   Primary CTA (large, Indigo):

    -   **Start a Popqiz**

-   Secondary CTA:

    -   **Join**

### Behavior

-   No login

-   No explanation required

-   Immediate navigation on tap

* * * * *

2\. Start Flow (`/start`)
-------------------------

### Purpose

Create a game room with one decision.

### UI

-   Title: **Who's playing?**

-   Age range selector (segmented control):

    -   Kids (6--9)

    -   Tweens (10--13)

    -   Family (default)

    -   Adults

-   Primary CTA:

    -   **Start Game**

### Behavior

-   Default: Family

-   On Start:

    -   Create room

    -   Randomly assign team color + fun team name (from pool of 100 unique names)

    -   Enter game immediately

* * * * *

3\. Join Flow (`/join`)
-----------------------

### Purpose

Join a game quickly using a code.

### UI

-   Input: **Room Code**

-   CTA:

    -   **Join Game**

### Behavior

-   Validate code

-   Randomly assign team color + name (from pool of 100 unique names, ensuring no duplicates in room)

-   Join current game state (or next question)

* * * * *

4\. Game Screen (Core Experience)
---------------------------------

### Persistent UI

-   Top-center: Team name with team color dot

-   Top-right:

    -   **More menu** (⋯ icon, no hover state - mobile-first design) containing:

        -   Invite Players

        -   New Game (host only - resets scores, reassigns team names/colors)

        -   Quit Game

-   No other persistent buttons during gameplay

* * * * *

5\. Question Screen
-------------------

### Purpose

Answer instantly with zero UI friction.

### UI

-   Question text (large, centered)

-   Circular countdown timer (above question)

-   Three stacked answer buttons (very large tap targets)

-   Bottom-center (pinned): **"Something looks off"** link (subtle, small text, semi-transparent white at 40% opacity for subtlety)

### Interaction

-   Tap answer → locks immediately

-   Button fills with team color

-   No correctness feedback yet

### Rules

-   One answer per player per round

-   First **correct** team earns a bonus point

-   No penalties for wrong answers

* * * * *

6\. Question Controls (Skip & Feedback)
---------------------------------------

### Purpose

Provide a safe escape hatch without disrupting flow.

### Access

-   **"Something looks off"** link pinned to bottom-center of question screen (subtle, small text)

### Bottom Sheet

Title: **Something off?**

Options:

-   **Skip Question**

-   **Not Appropriate**

-   **Bad / Confusing**

### Behavior

-   Any option:

    -   Immediately skips the question

    -   No points awarded

    -   Advances to next question

-   Feedback recorded silently

-   No text entry

-   No indication of who skipped

* * * * *

7\. Leaderboard Screen (Between Questions)
------------------------------------------

### Purpose

Celebrate wins and build momentum.

### UI

-   Confetti animation for round winner

-   Leaderboard:

    -   Team name

    -   Score

-   Subtle text:

    -   "Next question in 3..."

### Behavior

-   Displays ~5 seconds

-   Shows animated countdown ("5... 4... 3... 2... 1... ...")

-   Auto-advances to next question

-   No interaction required

* * * * *

8\. Invite / Party Sheet (Persistent)
-------------------------------------

### Access

More menu → **Invite Players**

### UI

-   Room code (large, tappable to copy)

-   QR code (styled with fluid rounded modules and rounded corner markers using react-qrcode-pretty library)

-   **Share Link** button (primary - uses native share sheet if available, falls back to copy)

-   **Copy Link** button (secondary - always copies to clipboard, uses dark text for readability)

### Rules

-   Does not interrupt gameplay

-   Joining mid-game is always allowed

-   Share URL includes room code parameter for auto-fill

* * * * *

9\. Joining Mid-Game Rules
--------------------------

-   New players:

    -   Join as a new team (randomly assigned name and color from available pool)

    -   Start at 0 points

    -   Appear immediately on leaderboard

-   Game does **not** reset automatically

-   Each room ensures no duplicate team names

* * * * *

10\. Scoring Rules
------------------

-   +1 correct answer

-   +1 bonus for first correct team

-   Skipped questions award no points

-   No penalties

* * * * *

11\. New Game (Host Only)
-------------------------

### Access

More menu → **New Game**

### Behavior

-   Resets all player scores to 0

-   Reassigns all players with new random team names and colors (from pool of 100 unique names)

-   Resets round number to 1

-   Starts fresh with new question

-   All players remain in the room

* * * * *

12\. Game End (Optional v1)
---------------------------

Game may run indefinitely.

Optional:

-   After N rounds (e.g. 10):

    -   Final leaderboard

    -   **Play Again** button

* * * * *

13\. Explicit Non-Goals (v1)
----------------------------

-   Accounts or profiles

-   Chat

-   Avatars or customization

-   Category selection

-   Difficulty tuning beyond age range

-   Persistent stats

-   Moderation dashboards

* * * * *

UX North Star
-------------

Every decision should reinforce:

> **"This is fun, fast, and effortless --- let's play another one."**