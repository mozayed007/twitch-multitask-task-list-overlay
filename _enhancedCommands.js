// ============================
// Enhanced Commands Configuration
// ============================
const _enhancedCommands = {
    // Theme Commands (Mod/Broadcaster only)
    theme: {
        commands: ['!theme'],
        description: 'Change the visual theme',
        usage: '!theme [theme-name]',
        modOnly: true
    },

    // Layout Commands (Mod/Broadcaster only)
    layout: {
        commands: ['!layout'],
        description: 'Change the layout composition',
        usage: '!layout [layout-name]',
        modOnly: true
    },

    resetPanel: {
        commands: ['!resetpanel'],
        description: 'Reset a draggable panel position',
        usage: '!resetpanel [panel] (layout)',
        modOnly: true
    },

    resetLayout: {
        commands: ['!resetlayout'],
        description: 'Reset all panel positions for a layout',
        usage: '!resetlayout (layout-name)',
        modOnly: true
    },

    // Backlog Commands (Everyone)
    backlog: {
        commands: ['!backlog'],
        description: 'Manage personal task backlog',
        usage: '!backlog add/done/remove [text/number]',
        modOnly: false,
        subCommands: {
            add: 'Add item to backlog',
            done: 'Mark backlog item as done',
            remove: 'Remove item from backlog',
            clear: 'Clear completed items (mod only)'
        }
    },

    // Viewer Info Commands (Everyone)
    setInfo: {
        commands: ['!setinfo'],
        description: 'Set personal information',
        usage: '!setinfo [field] [value]',
        modOnly: false
    },

    getInfo: {
        commands: ['!getinfo'],
        description: 'Get viewer information',
        usage: '!getinfo [username]',
        modOnly: false
    },

    // Timer Commands (Mod/Broadcaster only)
    pomodoro: {
        commands: ['!pomo', '!pomodoro'],
        description: 'Start a pomodoro cycle',
        usage: '!pomo [focus]/[break]/[sessions]',
        modOnly: true
    },

    pomoPause: {
        commands: ['!pomopause'],
        description: 'Pause the current timer',
        usage: '!pomopause',
        modOnly: true
    },

    pomoResume: {
        commands: ['!pomoresume'],
        description: 'Resume a paused timer',
        usage: '!pomoresume',
        modOnly: true
    },

    pomoReset: {
        commands: ['!pomoreset'],
        description: 'Reset timer and clear all sessions',
        usage: '!pomoreset',
        modOnly: true
    },

    pomoStatus: {
        commands: ['!pomostatus'],
        description: 'Get current timer status',
        usage: '!pomostatus',
        modOnly: false
    },

    stopTimer: {
        commands: ['!stoptimer', '!pomostop'],
        description: 'Stop the current timer',
        usage: '!stoptimer',
        modOnly: true
    }
};
