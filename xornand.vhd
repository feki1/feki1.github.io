library ieee;
use ieee.std_logic_1164.all;
entity xornand is port (A, B: in std_logic; Z: out std_logic);
end entity xornand;

architecture labfour of xornand is
component nandgate is port (A, B: in std_logic; C: out std_logic); end component;
signal J, K, L: std_logic;
begin
G1: nandgate port map(A => A, B => B, C => J);
G2: nandgate port map(A => A, B => J, C => K);
G3: nandgate port map(A => J, B => B, C => L);
G4: nandgate port map(A => K, B => L, C => Z);
end architecture labfour;
