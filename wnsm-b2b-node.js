const dayjs = require('dayjs')
const WnsmB2b = require('./wnsm-b2b')

module.exports = function(RED) {
  function WnsmB2bNode(config) {
    RED.nodes.createNode(this, config)
    var node = this
    
    // Retrieve the config node credentials
    node.credentials = RED.nodes.getNode(config.creds).credentials

    // Initialize
    const wnsm = new WnsmB2b(node.credentials.username, node.credentials.password)
    
    node.on('input', async function(msg, send, done) {
      const kundenNr = config.kundenNr ? config.kundenNr : msg.kundenNr
      const zaehlpunktNr = config.zaehlpunktNr ? config.zaehlpunktNr : msg.zaehlpunktNr

      let endpoint
      switch (config.request) {
        case 'all_zaehlpunkte':
          endpoint = '/zaehlpunkte/'
          break
        case 'all_messwerte':
          endpoint = '/zaehlpunkte/messwerte/'
          break
        case 'zaehlpunkt_messwerte':
          if (!kundenNr || !zaehlpunktNr) {
            done('Missing Kundennummer and/or Zählpunktnummer, both has to be provided via config or msg properties')
            return
          } else {
            endpoint = `/zaehlpunkte/${kundenNr}/${zaehlpunktNr}/messwerte`
          }
          break
        default:
          done('Missing request type')
          return
      }

      let dateFrom, dateTo
      switch (config.period) {
        case 'current_month':
          dateFrom = dayjs().startOf('month').format('YYYY-MM-DD')
          dateTo = dayjs().endOf('month').format('YYYY-MM-DD')
          break
        case 'previous_month':
          dateFrom = dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD')
          dateTo = dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD')
          break
        case 'yesterday':
          dateFrom = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
          dateTo = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
          break
        case 'last_three_days':
          dateFrom = dayjs().subtract(3, 'day').format('YYYY-MM-DD')
          dateTo = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
          break
        case 'custom':
          if (!msg.dateFrom || !msg.dateTo) {
            done('Missing msg properties dateFrom and/or dateTo')
            return
          }
          dateFrom = msg.dateFrom
          dateTo = msg.dateTo
          break
        default:
          done('Missing period')
          return
      }

      try {
        msg.payload = await wnsm.call(
          endpoint,
          endpoint === 'all_zaehlpunkte' ? undefined : {
            'datumVon': dateFrom,
            'datumBis': dateTo,
            'wertetyp': 'METER_READ'
          }
        )
      } catch (e) {
        done(e)
        return
      }
      
      send(msg)
      done()
    })
  }

  RED.nodes.registerType('wnsm-b2b', WnsmB2bNode)
}
