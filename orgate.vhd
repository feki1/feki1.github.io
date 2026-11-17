library ieee;
use ieee.std_logic_1164.all;
entity orgate is port (A, B: in std_logic; C: out std_logic);
end entity orgate;

architecture labone of orgate is begin C <= A or B;
end architecture labone;
