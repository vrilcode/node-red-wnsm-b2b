module.exports = function(RED) {
  function WsnmB2bCredentialsNode(config) {
    RED.nodes.createNode(this, config)
    var node = this

    node.username = config.username
    node.password = config.password
  }

  RED.nodes.registerType('wnsm-b2b-credentials', WsnmB2bCredentialsNode, {
    credentials: {
      username: {type: 'text'},
      password: {type: 'password'}
    }
  })
}