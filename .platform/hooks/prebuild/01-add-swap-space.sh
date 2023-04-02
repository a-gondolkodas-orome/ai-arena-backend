#!/bin/bash

set -o xtrace
set -e

SWAPFILE=/var/swapfile
SWAP_MEGABYTES=1024

if [ -f $SWAPFILE ]; then
  echo "Swapfile $SWAPFILE found, skipping"
  exit 0;
fi

dd if=/dev/zero of=$SWAPFILE bs=1M count=$SWAP_MEGABYTES
/sbin/mkswap $SWAPFILE
chmod 600 $SWAPFILE
/sbin/swapon $SWAPFILE
