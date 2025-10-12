import { useState, useEffect } from 'react';

const DEFAULT_PREFIXES = ['| ES |', '| FR |', '| EN |', '| PT |'];
const DEFAULT_SUFFIXES = ['HD', '1080', '4K', 'UHD', 'SD'];
const LS_KEY_PREFIXES = 'obviar_prefixes';
const LS_KEY_SUFFIXES = 'obviar_suffixes';
const LS_KEY_SELECTED_PREFIXES = 'selected_prefixes';
const LS_KEY_SELECTED_SUFFIXES = 'selected_suffixes';

export function useObviarPrefijosSufijos() {
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const [suffixes, setSuffixes] = useState<string[]>([]);
  const [selectedPrefixes, setSelectedPrefixes] = useState<string[]>([]);
  const [selectedSuffixes, setSelectedSuffixes] = useState<string[]>([]);

  useEffect(() => {
    setPrefixes(
      JSON.parse(localStorage.getItem(LS_KEY_PREFIXES) || 'null') || DEFAULT_PREFIXES
    );
    setSuffixes(
      JSON.parse(localStorage.getItem(LS_KEY_SUFFIXES) || 'null') || DEFAULT_SUFFIXES
    );
    setSelectedPrefixes(
      JSON.parse(localStorage.getItem(LS_KEY_SELECTED_PREFIXES) || 'null') || []
    );
    setSelectedSuffixes(
      JSON.parse(localStorage.getItem(LS_KEY_SELECTED_SUFFIXES) || 'null') || []
    );
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_KEY_PREFIXES, JSON.stringify(prefixes));
  }, [prefixes]);
  useEffect(() => {
    localStorage.setItem(LS_KEY_SUFFIXES, JSON.stringify(suffixes));
  }, [suffixes]);
  useEffect(() => {
    localStorage.setItem(LS_KEY_SELECTED_PREFIXES, JSON.stringify(selectedPrefixes));
  }, [selectedPrefixes]);
  useEffect(() => {
    localStorage.setItem(LS_KEY_SELECTED_SUFFIXES, JSON.stringify(selectedSuffixes));
  }, [selectedSuffixes]);

  const addPrefix = (p: string) => {
    if (!prefixes.includes(p)) setPrefixes([...prefixes, p]);
  };
  const removePrefix = (p: string) => {
    setPrefixes(prefixes.filter(x => x !== p));
    setSelectedPrefixes(selectedPrefixes.filter(x => x !== p));
  };
  const addSuffix = (s: string) => {
    if (!suffixes.includes(s)) setSuffixes([...suffixes, s]);
  };
  const removeSuffix = (s: string) => {
    setSuffixes(suffixes.filter(x => x !== s));
    setSelectedSuffixes(selectedSuffixes.filter(x => x !== s));
  };

  return {
    prefixes,
    suffixes,
    selectedPrefixes,
    selectedSuffixes,
    setSelectedPrefixes,
    setSelectedSuffixes,
    addPrefix,
    removePrefix,
    addSuffix,
    removeSuffix,
    setPrefixes,
    setSuffixes,
  };
}