library ieee;
use ieee.std_logic_1164.all;
entity nandgate is port (A, B: in std_logic; C: out std_logic);
end entity nandgate;

architecture labone of nandgate is begin C <= A nand B;
end architecture labone;
