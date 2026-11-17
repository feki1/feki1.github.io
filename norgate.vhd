library ieee;
use ieee.std_logic_1164.all;
entity norgate is port (A, B: in std_logic; C: out std_logic);
end entity norgate;

architecture labone of norgate is begin C <= A nor B;
end architecture labone;
