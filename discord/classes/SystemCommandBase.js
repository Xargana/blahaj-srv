const CommandBase = require('./CommandBase');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

class SystemCommandBase extends CommandBase {
  constructor(client) {
    super(client);
    
    // Add security check for all system commands
    const originalExecute = this.execute;
    this.execute = async function(interaction) {
      if (interaction.user.id !== process.env.AUTHORIZED_USER_ID) {
        return interaction.reply({
          content: "You are not authorized to use system commands.",
          ephemeral: true
        });
      }
      
      return originalExecute.call(this, interaction);
    };
  }
  
  async execCommand(command, options = {}) {
    try {
      const { stdout, stderr } = await execPromise(command, options);
      return { success: true, stdout, stderr };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        stdout: error.stdout,
        stderr: error.stderr
      };
    }
  }
}

module.exports = SystemCommandBase;
