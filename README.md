# Wiener Netze Smart Meter B2B API node for Node-RED

This package provides a node for Node-RED to access the (inofficial) Wiener Netze Smart Meter B2B API. So far only querying of Zählpunkte (metering points) metadata and Messwerte/Zählerstände (meter readings) is supported. The currently implemented authentication (via log.wien username and password) is a workaround as long as Wiener Netze 
is incapable of offering official API access, which has, however, been announced (see [portal user settings](https://smartmeter-business.wienernetze.at/#/benutzerprofil) or official manual, section 7.1). Be aware that the B2B API is not yet an official production version and can therefore change spontaneously. It is therefore advisable to check whether the requested data has been received.

# Installation

```
npm i @vrilcode/node-red-wnsm-b2b
```

# References

* [Wiener Netze Smart Meter B2B portal](https://smartmeter-business.wienernetze.at/)
* [Manual for Wiener Netze Smart Meter B2B portal](https://www.wienernetze.at/o/document/wienernetze/smartmeter_b2b-handbuch_final) (German)
* [Technical docs for Wiener Netze Smart Meter B2B API](https://api-portal.wienerstadtwerke.at/portal/apis/7f8a1cce-2a7e-4b18-840b-b0387ed9a3fc/apidocumentation) (German)
* [Home Assistant implementation](https://github.com/DarwinsBuddy/WienerNetzeSmartmeter) in Python, which was a starting point for this package (and which in turn was inspired by [this Python code](https://github.com/platysma/vienna-smartmeter))
