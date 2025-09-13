# LSP Peering Information

This document contains the raw peering information for Lightning Service Providers (LSPs) used in the Alby LSP Price Board.

## Olympus by ZEUS
```
031b301307574bbe9b9ac7b79cbe1700e31e544513eae0b5d7497483083f99e581@45.79.192.236:9735
031b301307574bbe9b9ac7b79cbe1700e31e544513eae0b5d7497483083f99e581@r46dwvxcdri754hf6n3rwexmc53h5x4natg5g6hidnxfzejm5xrqn2id.onion:9735
```

## Flashsats (flashsats.xyz)
```
038ba8f67ba8ff5c48764cdd3251c33598d55b203546d08a8f0ec9dcd9f27e3637@52.24.240.84:9735
038ba8f67ba8ff5c48764cdd3251c33598d55b203546d08a8f0ec9dcd9f27e3637@rpmeiboyov7obu7xvs4lsyaurimwlusvd4sqy5scrtfzrh5xoa7hllyd.onion:9735
```

## LNServer Wave
```
02b4552a7a85274e4da01a7c71ca57407181752e8568b31d51f13c111a2941dce3@159.223.176.115:48049
```

## Megalith LSP (confirmed)
```
038a9e56512ec98da2b5789761f7af8f280baf98a09282360cd6ff1381b5e889bf@64.23.162.51:9735
038a9e56512ec98da2b5789761f7af8f280baf98a09282360cd6ff1381b5e889bf@y4u5v6vqenjr4wlnpcp4ekftpyfrsu2sewcrzcl7ob2lctwqcvqpocid.onion:9735
```

## Megalith (alternative - host TBD)
```
03e30fda71887a916ef5548a4d02b06fe04aaa1a8de9e24134ce7f139cf79d7579@<host>:9735
```

## LNBiG [Hub-2]
```
033e9ce4e8f0e68f7db49ffb6b9eecc10605f3f3fcb3c630545887749ab515b9c7@213.174.156.72:9735
033e9ce4e8f0e68f7db49ffb6b9eecc10605f3f3fcb3c630545887749ab515b9c7@xbi6bipfby6prt6wddufgv5mq4mx2ihxsy4u4hycd73qfgc3oslonuid.onion:9735
```
**Alternative clearnet IP:** `46.229.165.154:9735`

---

## Usage Instructions

To peer with these LSPs from your Lightning node, use the `lncli connect` command:

```bash
# Example for Olympus
lncli connect 031b301307574bbe9b9ac7b79cbe1700e31e544513eae0b5d7497483083f99e581@45.79.192.236:9735

# Example for Flashsats
lncli connect 038ba8f67ba8ff5c48764cdd3251c33598d55b203546d08a8f0ec9dcd9f27e3637@52.24.240.84:9735

# Example for LNServer Wave
lncli connect 02b4552a7a85274e4da01a7c71ca57407181752e8568b31d51f13c111a2941dce3@159.223.176.115:48049

# Example for Megalith
lncli connect 038a9e56512ec98da2b5789761f7af8f280baf98a09282360cd6ff1381b5e889bf@64.23.162.51:9735

# Example for LNBiG
lncli connect 033e9ce4e8f0e68f7db49ffb6b9eecc10605f3f3fcb3c630545887749ab515b9c7@213.174.156.72:9735
```

## Notes

- **Clearnet addresses** are easier to connect to but may be less private
- **Tor addresses** (.onion) provide better privacy but require Tor to be running
- **Port 9735** is the standard Lightning Network port
- **LNServer Wave** uses port **48049** instead of the standard 9735
- Some LSPs may require specific connection parameters or have connection limits

## Troubleshooting

If you're experiencing connection issues:
1. Ensure your Lightning node is running and accessible
2. Check if your node has sufficient inbound/outbound capacity
3. Verify the LSP is online and accepting connections
4. Try both clearnet and Tor addresses if available
5. Check your firewall settings for port 9735 (or 48049 for LNServer Wave)
